package com.fleettrack.trip.client;

import com.fleettrack.trip.model.dto.DriverResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@RequiredArgsConstructor
public class DriverServiceClient {

    private final RestTemplate restTemplate;

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

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
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-Internal-Service-Key", internalServiceSecret);
            HttpEntity<Void> entity = new HttpEntity<>(headers);
            return restTemplate.exchange(
                    "http://driver-service/user/" + userId,
                    HttpMethod.GET,
                    entity,
                    DriverResponse.class
            ).getBody();
        } catch (Exception e) {
            return null;
        }
    }
}
