package com.fleettrack.gps.websocket;

import com.fleettrack.gps.client.DriverServiceClient;
import com.fleettrack.gps.client.TripServiceClient;
import com.fleettrack.gps.model.dto.DriverIdResponse;
import com.fleettrack.gps.model.dto.TripOwnerResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Regression guard for the WebSocket authorization hole.
 *
 * The interceptor previously validated only CONNECT frames. SUBSCRIBE was
 * unchecked, so any authenticated session — including one from a self-registered
 * DRIVER account via the public /auth/register — could subscribe to
 * /topic/trips/{anyId}/location and stream any driver's live position. That
 * bypassed the ownership and dispatch-role checks enforced on the equivalent
 * REST endpoints.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StompSubscribeAuthorizationTest {

    @Mock private RestTemplate restTemplate;
    @Mock private DriverServiceClient driverServiceClient;
    @Mock private TripServiceClient tripServiceClient;
    @Mock private MessageChannel channel;

    @InjectMocks private StompAuthChannelInterceptor interceptor;

    /** Builds a SUBSCRIBE frame whose session is already authenticated as `role`. */
    private Message<byte[]> subscribeAs(String role, Long userId, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setDestination(destination);

        Map<String, Object> session = new HashMap<>();
        if (role != null) session.put("ft.role", role);
        if (userId != null) session.put("ft.userId", userId);
        accessor.setSessionAttributes(session);

        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private void driverOwns(long userId, long profileId, long tripId, long tripDriverId) {
        DriverIdResponse profile = new DriverIdResponse();
        ReflectionTestUtils.setField(profile, "id", profileId);
        when(driverServiceClient.getDriverByUserId(userId)).thenReturn(profile);

        TripOwnerResponse trip = new TripOwnerResponse();
        ReflectionTestUtils.setField(trip, "driverId", tripDriverId);
        when(tripServiceClient.getTrip(tripId)).thenReturn(trip);
    }

    // ── The hole itself ─────────────────────────────────────────────────────

    @Test
    @DisplayName("driver CANNOT subscribe to another driver's trip")
    void driverCannotWatchAnotherDriver() {
        driverOwns(100L, 7L, 99L, 42L);   // caller owns profile 7; trip 99 belongs to 42

        assertThatThrownBy(() ->
                interceptor.preSend(subscribeAs("DRIVER", 100L, "/topic/trips/99/location"), channel))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("not assigned to this trip");
    }

    @Test
    @DisplayName("driver CAN subscribe to their own trip")
    void driverCanWatchOwnTrip() {
        driverOwns(100L, 7L, 55L, 7L);

        assertThatCode(() ->
                interceptor.preSend(subscribeAs("DRIVER", 100L, "/topic/trips/55/location"), channel))
                .doesNotThrowAnyException();
    }

    @ParameterizedTest(name = "{0} may watch any trip")
    @ValueSource(strings = {"ADMIN", "DISPATCHER", "SUPER_ADMIN"})
    @DisplayName("dispatch roles may subscribe to any trip")
    void dispatchRolesUnrestricted(String role) {
        assertThatCode(() ->
                interceptor.preSend(subscribeAs(role, 1L, "/topic/trips/12345/location"), channel))
                .doesNotThrowAnyException();
    }

    // ── Fail-closed behaviour ───────────────────────────────────────────────

    @Test
    @DisplayName("unauthenticated session cannot subscribe at all")
    void unauthenticatedSessionRejected() {
        assertThatThrownBy(() ->
                interceptor.preSend(subscribeAs(null, null, "/topic/trips/1/location"), channel))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("not authenticated");
    }

    @ParameterizedTest(name = "destination \"{0}\" is refused")
    @ValueSource(strings = {
            "/topic/trips/1/secret",
            "/topic/everything",
            "/topic/trips//location",
            "/topic/trips/abc/location",
            "/queue/admin",
            "/topic/trips/1/location/extra",
    })
    @DisplayName("only the exact per-trip location topic is subscribable")
    void unknownDestinationsRefused(String destination) {
        assertThatThrownBy(() ->
                interceptor.preSend(subscribeAs("ADMIN", 1L, destination), channel))
                .isInstanceOf(MessagingException.class);
    }

    /**
     * If the ownership lookup fails we must deny, never allow — an unavailable
     * dependency must not become a way to read another driver's location.
     */
    @Test
    @DisplayName("ownership check fails closed when a dependency errors")
    void failsClosedOnDependencyError() {
        when(driverServiceClient.getDriverByUserId(anyLong()))
                .thenThrow(new RuntimeException("driver-service unavailable"));

        assertThatThrownBy(() ->
                interceptor.preSend(subscribeAs("DRIVER", 100L, "/topic/trips/55/location"), channel))
                .isInstanceOf(MessagingException.class);
    }

    @Test
    @DisplayName("an unknown role is refused")
    void unknownRoleRejected() {
        assertThatThrownBy(() ->
                interceptor.preSend(subscribeAs("AUDITOR", 1L, "/topic/trips/1/location"), channel))
                .isInstanceOf(MessagingException.class)
                .hasMessageContaining("Access denied");
    }
}
