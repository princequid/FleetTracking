package com.fleettrack.vehicle.service;

import com.fleettrack.vehicle.model.entity.Vehicle;
import com.fleettrack.vehicle.model.enums.VehicleStatus;
import com.fleettrack.vehicle.repository.VehicleRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Guards the vehicle-release rule.
 *
 * Two bugs live here if this is got wrong:
 *
 *  1. Not releasing at all — which is what shipped. completeTrip never marked the
 *     vehicle AVAILABLE, so every delivered trip permanently removed a van from
 *     the dispatch pool and the usable fleet shrank with each delivery.
 *
 *  2. Releasing too eagerly — trip-service's reconciliation sweep runs on a timer
 *     and can fire long after a trip ended, by which point someone may have moved
 *     the vehicle to MAINTENANCE. A blanket "set AVAILABLE" would put an off-road
 *     van back into dispatch.
 *
 * The rule is therefore narrow on purpose: IN_USE → AVAILABLE, nothing else.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class VehicleReleaseTest {

    @Mock private VehicleRepository vehicleRepository;
    @InjectMocks private VehicleService vehicleService;

    private Vehicle vehicleWith(VehicleStatus status) {
        Vehicle v = Vehicle.builder().plateNumber("GT-1234-25").status(status).build();
        v.setId(1L);
        return v;
    }

    @Test
    @DisplayName("an IN_USE vehicle is released back to AVAILABLE")
    void releasesInUseVehicle() {
        Vehicle v = vehicleWith(VehicleStatus.IN_USE);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(v));

        boolean released = vehicleService.releaseIfInUse(1L);

        assertThat(released).isTrue();
        assertThat(v.getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
        verify(vehicleRepository).save(v);
    }

    /**
     * The important one. A vehicle taken off the road must stay off the road,
     * however late a trip event or reconciliation sweep arrives.
     */
    @ParameterizedTest(name = "a {0} vehicle is left alone")
    @EnumSource(value = VehicleStatus.class, names = {"MAINTENANCE", "DECOMMISSIONED", "AVAILABLE"})
    @DisplayName("any status other than IN_USE is never overwritten")
    void neverOverwritesOtherStatuses(VehicleStatus status) {
        Vehicle v = vehicleWith(status);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(v));

        boolean released = vehicleService.releaseIfInUse(1L);

        assertThat(released).isFalse();
        assertThat(v.getStatus())
                .as("releasing must not drag a vehicle out of %s", status)
                .isEqualTo(status);
        verify(vehicleRepository, never()).save(any(Vehicle.class));
    }

    /**
     * Releases are driven by retryable paths — a best-effort call after commit and
     * a repeating sweep — so the same release will happen more than once.
     */
    @Test
    @DisplayName("releasing twice is safe")
    void isIdempotent() {
        Vehicle v = vehicleWith(VehicleStatus.IN_USE);
        when(vehicleRepository.findById(1L)).thenReturn(Optional.of(v));

        assertThat(vehicleService.releaseIfInUse(1L)).isTrue();   // does the work
        assertThat(vehicleService.releaseIfInUse(1L)).isFalse();  // already AVAILABLE
        assertThat(v.getStatus()).isEqualTo(VehicleStatus.AVAILABLE);
    }

    @Test
    @DisplayName("an unknown vehicle is ignored rather than throwing")
    void missingVehicleDoesNotThrow() {
        when(vehicleRepository.findById(anyLong())).thenReturn(Optional.empty());

        // Must not throw: the caller is reconciling after the fact, and a deleted
        // vehicle is not a reason to fail a completed trip.
        assertThat(vehicleService.releaseIfInUse(999L)).isFalse();
    }

    @Test
    @DisplayName("a null id is ignored")
    void nullIdIsIgnored() {
        assertThat(vehicleService.releaseIfInUse(null)).isFalse();
        verify(vehicleRepository, never()).findById(anyLong());
    }
}
