package com.fleettrack.trip.controller;

import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.model.dto.DriverResponse;
import com.fleettrack.trip.model.dto.DriverTripStatsResponse;
import com.fleettrack.trip.service.TripService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

/**
 * Regression guard for the driver-stats IDOR.
 *
 * /trips/drivers/{driverId}/stats is routed publicly through the gateway and its
 * role list includes DRIVER, but it had no ownership check — so any driver could
 * enumerate ids and read every colleague's performance figures.
 *
 * The internal path (driver-service calling through with the internal key and no
 * role header) must keep working, since it backs the driver app's own stats card.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TripControllerAuthorizationTest {

    private static final String INTERNAL_SECRET = "test-internal-secret";

    @Mock private TripService tripService;
    @Mock private DriverServiceClient driverServiceClient;

    @InjectMocks private TripController controller;

    private void withInternalSecret() {
        ReflectionTestUtils.setField(controller, "internalServiceSecret", INTERNAL_SECRET);
    }

    private MockHttpServletRequest request(String role, String userId) {
        MockHttpServletRequest req = new MockHttpServletRequest();
        if (role != null) req.addHeader("X-User-Role", role);
        if (userId != null) req.addHeader("X-User-Id", userId);
        req.addHeader("X-Internal-Service-Key", INTERNAL_SECRET);
        return req;
    }

    private void driverProfileMaps(long userId, long profileId) {
        DriverResponse profile = new DriverResponse();
        ReflectionTestUtils.setField(profile, "id", profileId);
        when(driverServiceClient.getDriverByUserId(userId)).thenReturn(profile);
    }

    @Test
    @DisplayName("driver reading ANOTHER driver's stats is refused")
    void driverCannotReadOthersStats() {
        withInternalSecret();
        driverProfileMaps(100L, 7L);          // caller is driver profile 7
        when(tripService.getDriverTripStats(anyLong()))
                .thenReturn(new DriverTripStatsResponse());

        assertThatThrownBy(() ->
                controller.getDriverTripStats(99L, request("DRIVER", "100")))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Access denied");
    }

    @Test
    @DisplayName("driver reading their OWN stats is allowed")
    void driverCanReadOwnStats() {
        withInternalSecret();
        driverProfileMaps(100L, 7L);
        when(tripService.getDriverTripStats(7L)).thenReturn(new DriverTripStatsResponse());

        assertThatCode(() -> controller.getDriverTripStats(7L, request("DRIVER", "100")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("dispatch roles may read any driver's stats")
    void dispatchRolesUnrestricted() {
        withInternalSecret();
        when(tripService.getDriverTripStats(anyLong()))
                .thenReturn(new DriverTripStatsResponse());

        for (String role : new String[] {"ADMIN", "DISPATCHER", "SUPER_ADMIN"}) {
            assertThatCode(() -> controller.getDriverTripStats(99L, request(role, "1")))
                    .as("%s should not be ownership-restricted", role)
                    .doesNotThrowAnyException();
        }
    }

    /**
     * driver-service calls this with the internal key and NO role header, to back
     * the driver app's performance card. That path must stay open, or the fix
     * would have broken the mobile app.
     */
    @Test
    @DisplayName("internal service call (no role header) is not ownership-restricted")
    void internalCallStillWorks() {
        withInternalSecret();
        DriverTripStatsResponse stats = new DriverTripStatsResponse();
        when(tripService.getDriverTripStats(42L)).thenReturn(stats);

        assertThatCode(() -> controller.getDriverTripStats(42L, request(null, null)))
                .doesNotThrowAnyException();
        assertThat(controller.getDriverTripStats(42L, request(null, null)).getBody())
                .isSameAs(stats);
    }
}
