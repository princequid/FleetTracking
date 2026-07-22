package com.fleettrack.notification.client;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@Slf4j
public class DriverDirectoryClient {

    private final RestTemplate restTemplate;

    public DriverDirectoryClient(@Qualifier("internalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** Best-effort — returns "Driver #{userId}" if driver-service is unreachable or the profile is missing. */
    public String getDriverName(Long userId) {
        if (userId == null) return "Unknown driver";
        try {
            DriverProfile profile = restTemplate.getForObject(
                    "http://driver-service/user/" + userId, DriverProfile.class);
            if (profile != null && profile.getFullName() != null && !profile.getFullName().isBlank()) {
                return profile.getFullName();
            }
        } catch (Exception e) {
            log.warn("Failed to fetch driver name for user {}: {}", userId, e.getMessage());
        }
        return "Driver #" + userId;
    }

    @Data
    private static class DriverProfile {
        private String fullName;
    }
}
