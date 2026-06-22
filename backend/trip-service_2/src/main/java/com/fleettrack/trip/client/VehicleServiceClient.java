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
}
