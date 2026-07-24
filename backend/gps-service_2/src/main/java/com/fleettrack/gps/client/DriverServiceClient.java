package com.fleettrack.gps.client;

import com.fleettrack.gps.model.dto.DriverIdResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

// Maps the authenticated caller's X-User-Id (an auth-service user id) onto their
// driver-profile id, mirroring trip-service's/media-service's own DriverServiceClient.
// Trips (and therefore ping/route ownership) are keyed by driver-profile id, not
// auth-service user id.
@Component
@RequiredArgsConstructor
public class DriverServiceClient {

    private final RestTemplate restTemplate;

    public DriverIdResponse getDriverByUserId(Long userId) {
        try {
            return restTemplate.getForObject("http://driver-service/user/" + userId, DriverIdResponse.class);
        } catch (Exception e) {
            return null;
        }
    }
}
