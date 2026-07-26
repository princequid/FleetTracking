package com.fleettrack.media.client;

import com.fleettrack.media.model.dto.TripResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

// Used by MediaService to verify photo ownership: a driver may only upload/view
// photos for a trip they are actually assigned to.
@Component
@RequiredArgsConstructor
public class TripServiceClient {

    private final RestTemplate restTemplate;

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    public TripResponse getTrip(Long tripId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Internal-Service-Key", internalServiceSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            return restTemplate.exchange(
                    "http://trip-service/" + tripId,
                    HttpMethod.GET,
                    entity,
                    TripResponse.class
            ).getBody();
        } catch (Exception e) {
            throw new RuntimeException("Trip not found or trip-service unavailable");
        }
    }
}
