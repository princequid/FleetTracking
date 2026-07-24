package com.fleettrack.incident.client;

import com.fleettrack.incident.model.dto.TripOwnerResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

// Used to verify a DRIVER caller actually owns the trip they're reporting an incident
// against — the injected RestTemplate already stamps X-Internal-Service-Key via its
// interceptor (see RestTemplateConfig), so no manual header handling is needed here.
@Component
@RequiredArgsConstructor
public class TripServiceClient {

    private final RestTemplate restTemplate;

    public TripOwnerResponse getTrip(Long tripId) {
        try {
            return restTemplate.getForObject("http://trip-service/" + tripId, TripOwnerResponse.class);
        } catch (Exception e) {
            return null;
        }
    }
}
