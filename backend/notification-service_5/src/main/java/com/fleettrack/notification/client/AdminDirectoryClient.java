package com.fleettrack.notification.client;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Set;

/**
 * Fetches the staff directory (ADMIN/DISPATCHER/SUPER_ADMIN accounts) from
 * auth-service's GET /auth/staff — this is a direct Eureka-resolved call, bypassing
 * the gateway, so it never carries a caller-derived JWT. StaffController instead
 * checks X-User-Role directly, so this client sets it to SUPER_ADMIN to represent
 * "this is a trusted internal caller acting with full staff-directory access"
 * (X-Internal-Service-Key, added automatically by RestTemplateConfig's interceptor,
 * is what actually proves the call is trusted).
 */
@Component
@Slf4j
public class AdminDirectoryClient {

    private static final Set<String> CRITICAL_ALERT_ROLES = Set.of("ADMIN", "SUPER_ADMIN");

    private final RestTemplate restTemplate;

    public AdminDirectoryClient(@Qualifier("internalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    /** ADMIN + SUPER_ADMIN only — recipients for urgent, safety-critical alerts. */
    public List<StaffMember> getCriticalAlertRecipients() {
        return fetchStaff().stream()
                .filter(s -> CRITICAL_ALERT_ROLES.contains(s.getRole()))
                .toList();
    }

    /** ADMIN + DISPATCHER + SUPER_ADMIN — recipients for the daily fleet summary. */
    public List<StaffMember> getSummaryRecipients() {
        return fetchStaff();
    }

    private List<StaffMember> fetchStaff() {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("X-User-Role", "SUPER_ADMIN");
            var response = restTemplate.exchange(
                    "http://auth-service/auth/staff",
                    HttpMethod.GET,
                    new HttpEntity<>(headers),
                    StaffMember[].class);
            StaffMember[] body = response.getBody();
            return body != null ? List.of(body) : List.of();
        } catch (Exception e) {
            log.warn("Failed to fetch staff directory from auth-service: {}", e.getMessage());
            return List.of();
        }
    }
}
