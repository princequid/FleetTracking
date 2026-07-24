package com.fleettrack.gps.websocket;

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

import java.util.Map;

/**
 * Validates the Bearer token the admin portal sends as a STOMP CONNECT header
 * (useFleetWebSocket.js's connectHeaders) before the websocket session is allowed to
 * proceed. Without this, /ws was unauthenticated at every layer: the gateway lists
 * /ws in JwtAuthFilter.PUBLIC_PATHS (the initial HTTP/SockJS handshake needs no
 * token), and gps-service's own InternalKeyFilter explicitly exempts /ws too — so a
 * STOMP-level check is the only place authentication for this connection can happen
 * at all. Calls auth-service's /auth/validate, the same endpoint the gateway itself
 * uses, so there's exactly one source of truth for "is this token valid."
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private final RestTemplate restTemplate;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String authHeader = accessor.getFirstNativeHeader("Authorization");
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                log.debug("Rejecting STOMP CONNECT — missing or malformed Authorization header");
                throw new MessagingException("Missing or invalid Authorization header");
            }
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.set(HttpHeaders.AUTHORIZATION, authHeader);
                restTemplate.exchange(
                        "http://auth-service/auth/validate",
                        HttpMethod.GET,
                        new HttpEntity<>(headers),
                        Map.class);
            } catch (Exception e) {
                log.debug("Rejecting STOMP CONNECT — token validation failed: {}", e.getMessage());
                throw new MessagingException("Invalid or expired token");
            }
        }
        return message;
    }
}
