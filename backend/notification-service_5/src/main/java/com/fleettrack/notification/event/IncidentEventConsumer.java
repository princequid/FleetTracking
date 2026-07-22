package com.fleettrack.notification.event;

import com.fleettrack.events.IncidentReportedEvent;
import com.fleettrack.notification.client.AdminDirectoryClient;
import com.fleettrack.notification.client.DriverDirectoryClient;
import com.fleettrack.notification.client.IncidentServiceClient;
import com.fleettrack.notification.client.StaffMember;
import com.fleettrack.notification.config.RabbitMQConfig;
import com.fleettrack.notification.email.EmailService;
import com.fleettrack.notification.email.EmailTemplates;
import com.fleettrack.notification.model.enums.NotificationType;
import com.fleettrack.notification.service.NotificationService;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Consumes incident.reported events off their own dedicated queue (see
 * RabbitMQConfig.INCIDENT_QUEUE — kept separate from NOTIFICATION_QUEUE so this
 * doesn't compete with TripEventConsumer for the same deliveries). Every incident
 * gets an in-app/push acknowledgement to the reporting driver; CRITICAL incidents
 * additionally email every ADMIN/SUPER_ADMIN.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class IncidentEventConsumer {

    private static final DateTimeFormatter TIMESTAMP_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final NotificationService notificationService;
    private final EmailService emailService;
    private final AdminDirectoryClient adminDirectoryClient;
    private final DriverDirectoryClient driverDirectoryClient;
    private final IncidentServiceClient incidentServiceClient;

    @Value("${fleetsync.admin-portal-url}")
    private String adminPortalUrl;

    @RabbitListener(queues = RabbitMQConfig.INCIDENT_QUEUE)
    public void handleEvent(IncidentReportedEvent event, Channel channel,
                             @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws Exception {
        try {
            if (!"incident.reported".equals(event.getEventType())) {
                log.debug("Ignoring event type {}", event.getEventType());
                channel.basicAck(deliveryTag, false);
                return;
            }

            // Baseline in-app/push acknowledgement to the reporting driver.
            notificationService.createFromEvent(
                    event.getEventId(), event.getDriverId(), NotificationType.INCIDENT_REPORTED,
                    "Incident reported",
                    "Your " + event.getIncidentType() + " report has been submitted for review.",
                    event.getTripId());

            if ("CRITICAL".equals(event.getSeverity())) {
                notifyAdminsOfCriticalIncident(event);
            }

            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            log.error("Failed to process incident event, dropping", e);
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private void notifyAdminsOfCriticalIncident(IncidentReportedEvent event) {
        var incident = incidentServiceClient.getIncident(event.getIncidentId());
        String description = incident != null && incident.getDescription() != null
                ? incident.getDescription() : "No description provided.";
        String driverName = driverDirectoryClient.getDriverName(event.getDriverId());
        String timestamp = TIMESTAMP_FORMAT.format(event.getOccurredAt());
        String incidentUrl = adminPortalUrl + "/incidents/" + event.getIncidentId();

        String html = EmailTemplates.buildCriticalIncidentEmail(
                String.valueOf(event.getIncidentId()),
                event.getTripId() != null ? String.valueOf(event.getTripId()) : null,
                driverName,
                event.getIncidentType(),
                description,
                timestamp,
                incidentUrl);

        for (StaffMember admin : adminDirectoryClient.getCriticalAlertRecipients()) {
            emailService.sendEmail(admin.getEmail(), "CRITICAL Incident Reported — FleetSync", html);
        }
    }
}
