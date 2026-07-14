package com.fleettrack.trip.client;

import com.fleettrack.trip.model.dto.DriverResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class DriverServiceClient {

    private final RestTemplate restTemplate;

    // Note: X-Internal-Service-Key is added to every outgoing call by the shared
    // interceptor registered in RestTemplateConfig — no need to set it here per-request.

    public DriverResponse getDriver(Long driverId) {
        try {
            return restTemplate.getForObject(
                    "http://driver-service/" + driverId,
                    DriverResponse.class
            );
        } catch (Exception e) {
            throw new RuntimeException("Driver not found or driver-service unavailable");
        }
    }

    public DriverResponse getDriverByUserId(Long userId) {
        try {
            return restTemplate.getForObject(
                    "http://driver-service/user/" + userId,
                    DriverResponse.class
            );
        } catch (Exception e) {
            return null;
        }
    }
}
