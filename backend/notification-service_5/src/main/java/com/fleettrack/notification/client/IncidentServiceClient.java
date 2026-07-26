package com.fleettrack.notification.client;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

/**
 * Fetches full incident detail (description) from incident-service — the
 * incident.reported event only carries ids/severity/type, not the free-text
 * description, so the critical-alert email needs this extra lookup.
 */
@Component
@Slf4j
public class IncidentServiceClient {

    private final RestTemplate restTemplate;

    public IncidentServiceClient(@Qualifier("internalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** Best-effort — returns null if incident-service is unreachable. */
    public IncidentDetail getIncident(Long incidentId) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Role", "SUPER_ADMIN");
            var response = restTemplate.exchange(
                    "http://incident-service/" + incidentId,
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    IncidentDetail.class);
            return response.getBody();
        } catch (Exception e) {
            log.warn("Failed to fetch incident {} from incident-service: {}", incidentId, e.getMessage());
            return null;
        }
    }

    @Data
    public static class IncidentDetail {
        private Long id;
        private Long tripId;
        private Long driverId;
        private String incidentType;
        private String severity;
        private String description;
        private String status;
        private String createdAt;
    }
}
