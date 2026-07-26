package com.fleettrack.driver.client;

import com.fleettrack.driver.model.dto.TripStatsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
@Slf4j
public class TripServiceClient {

    private final RestTemplate restTemplate;

    // Never lets a slow/unreachable trip-service take the driver's stats endpoint down
    // with it — falls back to zeroed stats so the profile screen still renders.
    public TripStatsResponse getDriverTripStats(Long driverId) {
        try {
            TripStatsResponse response = restTemplate.getForObject(
                    "http://trip-service/drivers/" + driverId + "/stats",
                    TripStatsResponse.class
            );
            return response != null ? response : new TripStatsResponse();
        } catch (Exception e) {
            log.warn("trip-service unavailable — returning zeroed stats for driver {}", driverId, e);
            return new TripStatsResponse();
        }
    }
}
