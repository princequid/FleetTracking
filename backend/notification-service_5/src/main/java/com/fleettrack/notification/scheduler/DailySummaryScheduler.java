package com.fleettrack.notification.scheduler;

import com.fleettrack.notification.client.AdminDirectoryClient;
import com.fleettrack.notification.client.AnalyticsClient;
import com.fleettrack.notification.client.StaffMember;
import com.fleettrack.notification.email.EmailService;
import com.fleettrack.notification.email.EmailTemplates;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Emails every admin/dispatcher a summary of yesterday's fleet activity, every
 * morning at 07:00. Depends on analytics-service's /fleet/summary and
 * /deliveries/daily endpoints (see AnalyticsClient) — if analytics-service can't
 * be reached or hasn't implemented them yet, this logs and skips the run rather
 * than emailing incomplete/zeroed stats.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DailySummaryScheduler {

    private final AnalyticsClient analyticsClient;
    private final AdminDirectoryClient adminDirectoryClient;
    private final EmailService emailService;

    @Value("${fleetsync.admin-portal-url}")
    private String adminPortalUrl;

    @Scheduled(cron = "0 0 7 * * *")
    public void dispatchDailySummary() {
        AnalyticsClient.FleetSummary fleetSummary = analyticsClient.getFleetSummary();
        AnalyticsClient.DailyDeliveries deliveries = analyticsClient.getDailyDeliveries(LocalDate.now().minusDays(1));

        if (fleetSummary == null || deliveries == null) {
            log.warn("Skipping daily summary email — analytics-service data unavailable");
            return;
        }

        String html = EmailTemplates.buildDailySummaryEmail(
                String.valueOf(deliveries.getCompletedDeliveries()),
                deliveries.getOnTimeRate() != null ? Math.round(deliveries.getOnTimeRate()) + "%" : "--",
                String.valueOf(fleetSummary.getIncidentsToday()),
                String.valueOf(fleetSummary.getActiveTrips()),
                adminPortalUrl);

        for (StaffMember recipient : adminDirectoryClient.getSummaryRecipients()) {
            emailService.sendEmail(recipient.getEmail(), "Daily Summary — FleetSync", html);
        }
    }
}
