package com.fleettrack.gps.websocket;

import com.fleettrack.gps.client.DriverServiceClient;
import com.fleettrack.gps.client.TripServiceClient;
import com.fleettrack.gps.model.dto.DriverIdResponse;
import com.fleettrack.gps.model.dto.TripOwnerResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authenticates STOMP CONNECT and authorizes STOMP SUBSCRIBE.
 *
 * CONNECT: validates the Bearer token the clients send as a connect header.
 * Without this, /ws is unauthenticated at every layer — the gateway lists /ws in
 * JwtAuthFilter.PUBLIC_PATHS (the SockJS handshake carries no token) and
 * gps-service's InternalKeyFilter exempts /ws too, so this is the only place
 * authentication for the connection can happen. Calls auth-service's
 * /auth/validate, the same endpoint the gateway uses, so there is one source of
 * truth for "is this token valid".
 *
 * SUBSCRIBE: previously unchecked, which meant authentication without
 * authorization. Any valid token — including one from a self-registered DRIVER
 * account via the public /auth/register — could subscribe to
 * /topic/trips/{anyId}/location and stream any driver's live position, bypassing
 * the ownership and dispatch-role checks that GpsController enforces on the
 * equivalent REST endpoints. Destination-level authorization closes that.
 *
 * The principal resolved at CONNECT is cached in the STOMP session attributes so
 * SUBSCRIBE does not re-hit auth-service on every frame.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final Pattern TRIP_TOPIC =
            Pattern.compile("^/topic/trips/(\\d+)/location$");

    private static final List<String> DISPATCH_ROLES =
            List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");

    private static final String ATTR_ROLE = "ft.role";
    private static final String ATTR_USER_ID = "ft.userId";

    private final RestTemplate restTemplate;
    private final DriverServiceClient driverServiceClient;
    private final TripServiceClient tripServiceClient;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();

        if (StompCommand.CONNECT.equals(command)) {
            handleConnect(accessor);
        } else if (StompCommand.SUBSCRIBE.equals(command)) {
            handleSubscribe(accessor);
        }

        return message;
    }

    private void handleConnect(StompHeaderAccessor accessor) {
        String authHeader = accessor.getFirstNativeHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.debug("Rejecting STOMP CONNECT — missing or malformed Authorization header");
            throw new MessagingException("Missing or invalid Authorization header");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set(HttpHeaders.AUTHORIZATION, authHeader);
            ResponseEntityMap validated = new ResponseEntityMap(
                    restTemplate.exchange(
                            "http://auth-service/auth/validate",
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            Map.class).getBody());

            // Cache the identity for SUBSCRIBE authorization on this session.
            Map<String, Object> attrs = accessor.getSessionAttributes();
            if (attrs != null) {
                attrs.put(ATTR_ROLE, validated.string("role"));
                attrs.put(ATTR_USER_ID, validated.longValue("userId"));
            }
        } catch (Exception e) {
            log.debug("Rejecting STOMP CONNECT — token validation failed: {}", e.getMessage());
            throw new MessagingException("Invalid or expired token");
        }
    }

    private void handleSubscribe(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            throw new MessagingException("Subscription destination is required");
        }

        Matcher matcher = TRIP_TOPIC.matcher(destination);
        if (!matcher.matches()) {
            // Deny by default: only the known per-trip location topic is
            // subscribable. A new topic must be added here deliberately rather
            // than being world-readable the moment it is published to.
            log.debug("Rejecting STOMP SUBSCRIBE — unrecognised destination {}", destination);
            throw new MessagingException("Subscription to this destination is not permitted");
        }

        Map<String, Object> attrs = accessor.getSessionAttributes();
        String role = attrs == null ? null : (String) attrs.get(ATTR_ROLE);
        Long userId = attrs == null ? null : (Long) attrs.get(ATTR_USER_ID);

        if (role == null) {
            throw new MessagingException("Session is not authenticated");
        }

        // Dispatch roles may watch any trip — same rule as GET /gps/trips/active.
        if (DISPATCH_ROLES.contains(role)) {
            return;
        }

        if (!"DRIVER".equals(role)) {
            throw new MessagingException("Access denied");
        }

        long tripId = Long.parseLong(matcher.group(1));
        if (!driverOwnsTrip(userId, tripId)) {
            log.debug("Rejecting STOMP SUBSCRIBE — user {} is not assigned to trip {}", userId, tripId);
            throw new MessagingException("You are not assigned to this trip");
        }
    }

    /**
     * Mirrors GpsController.verifyDriverOwnsTrip: X-User-Id is an auth-service
     * user id, while trips are keyed by driver-profile id, so one must be
     * resolved to the other before comparing.
     */
    private boolean driverOwnsTrip(Long userId, long tripId) {
        if (userId == null) return false;
        try {
            DriverIdResponse profile = driverServiceClient.getDriverByUserId(userId);
            if (profile == null || profile.getId() == null) return false;

            TripOwnerResponse trip = tripServiceClient.getTrip(tripId);
            return trip != null
                    && trip.getDriverId() != null
                    && trip.getDriverId().equals(profile.getId());
        } catch (Exception e) {
            // Fail closed — an unavailable dependency must not grant access to
            // another driver's live location.
            log.warn("Ownership check failed for user {} on trip {}: {}", userId, tripId, e.getMessage());
            return false;
        }
    }

    /** Small null-safe reader for the /auth/validate response body. */
    private static final class ResponseEntityMap {
        private final Map<?, ?> body;

        ResponseEntityMap(Map<?, ?> body) {
            this.body = body;
        }

        String string(String key) {
            Object v = body == null ? null : body.get(key);
            return v == null ? null : String.valueOf(v);
        }

        Long longValue(String key) {
            Object v = body == null ? null : body.get(key);
            if (v == null) return null;
            if (v instanceof Number n) return n.longValue();
            try {
                return Long.parseLong(String.valueOf(v));
            } catch (NumberFormatException e) {
                return null;
            }
        }
    }
}
