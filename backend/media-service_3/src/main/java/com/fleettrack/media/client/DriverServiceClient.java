package com.fleettrack.media.client;

import com.fleettrack.media.model.dto.DriverResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

// Minimal client — only what MediaService needs to map the authenticated caller's
// X-User-Id (an auth-service user id) onto their driver-profile id, mirroring
// trip-service's own DriverServiceClient#getDriverByUserId. Trips (and therefore
// photo ownership) are keyed by driver-profile id, not auth-service user id.
@Component
@RequiredArgsConstructor
public class DriverServiceClient {

    private final RestTemplate restTemplate;

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

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
