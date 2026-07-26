package com.fleettrack.notification.client;

import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;

/**
 * Reads fleet-wide stats from analytics-service for the daily summary email.
 *
 * NOTE: analytics-service (as of this change) only has its controller/service/entities
 * scaffolded as empty placeholders — GET /fleet/summary and GET /deliveries/daily don't
 * exist there yet. Calls here fail gracefully (return null, logged), so the daily
 * summary scheduler simply skips sending until analytics-service implements them —
 * building out analytics-service itself is a separate, larger piece of work beyond
 * adding email capability to auth-service/notification-service.
 */
@Component
@Slf4j
public class AnalyticsClient {

    private final RestTemplate restTemplate;

    public AnalyticsClient(@Qualifier("internalRestTemplate") RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public FleetSummary getFleetSummary() {
        try {
            return restTemplate.getForObject("http://analytics-service/fleet/summary", FleetSummary.class);
        } catch (Exception e) {
            log.warn("Failed to fetch fleet summary from analytics-service: {}", e.getMessage());
            return null;
        }
    }

    public DailyDeliveries getDailyDeliveries(LocalDate date) {
        try {
            return restTemplate.getForObject(
                    "http://analytics-service/deliveries/daily?date=" + date, DailyDeliveries.class);
        } catch (Exception e) {
            log.warn("Failed to fetch daily deliveries from analytics-service: {}", e.getMessage());
            return null;
        }
    }

    @Data
    public static class FleetSummary {
        private Integer activeTrips;
        private Integer incidentsToday;
    }

    @Data
    public static class DailyDeliveries {
        private Integer completedDeliveries;
        private Double onTimeRate;
    }
}
