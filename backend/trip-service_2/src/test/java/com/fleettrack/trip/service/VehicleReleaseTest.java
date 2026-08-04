package com.fleettrack.trip.service;

import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.client.MediaServiceClient;
import com.fleettrack.trip.client.VehicleServiceClient;
import com.fleettrack.trip.model.dto.MediaPodStatusResponse;
import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.enums.TripStatus;
import com.fleettrack.trip.repository.TripRepository;
import com.fleettrack.trip.repository.TripStatusHistoryRepository;
import com.fleettrack.trip.repository.TripStopRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression guard: a finished trip must return its vehicle to the fleet.
 *
 * completeTrip never touched vehicle status at all, so every DELIVERED trip left
 * its vehicle stuck IN_USE permanently — it could not be assigned again, and the
 * usable fleet shrank by one with each successful delivery.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VehicleReleaseTest {

    private static final long TRIP_ID = 42L;
    private static final long VEHICLE_ID = 7L;

    @Mock private TripRepository tripRepository;
    @Mock private TripStatusHistoryRepository statusHistoryRepository;
    @Mock private TripStopRepository tripStopRepository;
    @Mock private DriverServiceClient driverServiceClient;
    @Mock private VehicleServiceClient vehicleServiceClient;
    @Mock private MediaServiceClient mediaServiceClient;
    @Mock private OutboxPublisherService outboxPublisherService;
    @Mock private EtaService etaService;

    @InjectMocks private TripService tripService;

    private Trip tripAt(TripStatus status) {
        Trip trip = Trip.builder()
                .driverId(3L)
                .vehicleId(VEHICLE_ID)
                .origin("Kotei")
                .destination("Ayeduase")
                .build();
        trip.setId(TRIP_ID);
        trip.setStatus(status);
        return trip;
    }

    private void podIsPresent() {
        MediaPodStatusResponse pod = new MediaPodStatusResponse();
        ReflectionTestUtils.setField(pod, "hasPOD", Boolean.TRUE);
        when(mediaServiceClient.getPodStatus(TRIP_ID)).thenReturn(pod);
    }

    // ── The bug ─────────────────────────────────────────────────────────────

    @Test
    @DisplayName("completing a trip returns the vehicle to AVAILABLE")
    void completeReleasesVehicle() {
        Trip trip = tripAt(TripStatus.ARRIVED);
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));
        podIsPresent();

        tripService.completeTrip(TRIP_ID, 1L, null);

        // releaseVehicle, not updateVehicleStatus(id, "AVAILABLE"): the dedicated
        // endpoint refuses to pull a vehicle out of MAINTENANCE. See VehicleService
        // .releaseIfInUse in vehicle-service for the rule being relied on here.
        verify(vehicleServiceClient).releaseVehicle(VEHICLE_ID);
    }

    @Test
    @DisplayName("cancelling a trip returns the vehicle to AVAILABLE")
    void cancelReleasesVehicle() {
        Trip trip = tripAt(TripStatus.ASSIGNED);
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));

        tripService.cancelTrip(TRIP_ID, 1L);

        verify(vehicleServiceClient).releaseVehicle(VEHICLE_ID);
    }

    /**
     * The trip is already committed and its event already in the outbox by this
     * point — a delivery must not appear to fail because vehicle-service blipped.
     * The sweep below is what repairs the status.
     */
    @Test
    @DisplayName("a vehicle-service outage does not fail the completion")
    void vehicleServiceFailureDoesNotBreakCompletion() {
        Trip trip = tripAt(TripStatus.ARRIVED);
        when(tripRepository.findById(TRIP_ID)).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(i -> i.getArgument(0));
        podIsPresent();
        doThrow(new RuntimeException("vehicle-service down"))
                .when(vehicleServiceClient).releaseVehicle(anyLong());

        assertThat(tripService.completeTrip(TRIP_ID, 1L, null)).isNotNull();
    }

    // ── The safety net ──────────────────────────────────────────────────────

    @Test
    @DisplayName("reconciliation frees a vehicle whose trip ended but was never released")
    void reconciliationFreesStrandedVehicle() {
        when(tripRepository.findRecentlyEndedVehicleIds(any(Instant.class)))
                .thenReturn(new java.util.HashSet<>(Set.of(VEHICLE_ID)));
        when(tripRepository.findActiveVehicleIds(any())).thenReturn(Set.of());

        tripService.reconcileStrandedVehicles();

        verify(vehicleServiceClient).releaseVehicle(VEHICLE_ID);
    }

    /**
     * A freed vehicle can be reassigned immediately, so the sweep must never take
     * one back from a trip that has since started using it.
     */
    @Test
    @DisplayName("reconciliation leaves a vehicle held by a live trip alone")
    void reconciliationSkipsVehicleOnActiveTrip() {
        when(tripRepository.findRecentlyEndedVehicleIds(any(Instant.class)))
                .thenReturn(new java.util.HashSet<>(Set.of(VEHICLE_ID)));
        when(tripRepository.findActiveVehicleIds(any())).thenReturn(Set.of(VEHICLE_ID));

        tripService.reconcileStrandedVehicles();

        verify(vehicleServiceClient, never()).releaseVehicle(anyLong());
    }

    @Test
    @DisplayName("reconciliation does nothing when no trips ended recently")
    void reconciliationNoOpWhenNothingEnded() {
        when(tripRepository.findRecentlyEndedVehicleIds(any(Instant.class)))
                .thenReturn(new java.util.HashSet<>());

        tripService.reconcileStrandedVehicles();

        verify(vehicleServiceClient, never()).releaseVehicle(anyLong());
    }
}
