package com.fleettrack.trip.client;

import com.fleettrack.trip.model.dto.VehicleResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Component
@RequiredArgsConstructor
public class VehicleServiceClient {

    private final RestTemplate restTemplate;

    public VehicleResponse getVehicle(Long vehicleId) {
        try {
            return restTemplate.getForObject(
                    "http://vehicle-service/" + vehicleId,
                    VehicleResponse.class
            );
        } catch (Exception e) {
            throw new RuntimeException("Vehicle not found or vehicle-service unavailable");
        }
    }

    public void updateVehicleStatus(Long vehicleId, String status) {
        try {
            restTemplate.put(
                    "http://vehicle-service/" + vehicleId + "/status",
                    Map.of("status", status)
            );
        } catch (Exception e) {
            throw new RuntimeException("Failed to update vehicle status");
        }
    }

    /**
     * Hands a vehicle back to the dispatch pool when its trip ends.
     *
     * Use this rather than {@code updateVehicleStatus(id, "AVAILABLE")}: the
     * dedicated endpoint only flips IN_USE → AVAILABLE, so it cannot drag a
     * vehicle out of MAINTENANCE. That matters most for the reconciliation sweep,
     * which fires on a timer and may well run after someone has taken the vehicle
     * off the road for a legitimate reason.
     */
    public void releaseVehicle(Long vehicleId) {
        try {
            restTemplate.put("http://vehicle-service/" + vehicleId + "/release", null);
        } catch (Exception e) {
            throw new RuntimeException("Failed to release vehicle");
        }
    }
}
