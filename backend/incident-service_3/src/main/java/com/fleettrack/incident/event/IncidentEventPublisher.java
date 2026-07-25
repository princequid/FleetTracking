package com.fleettrack.incident.event;

import com.fleettrack.events.IncidentReportedEvent;
import com.fleettrack.incident.model.entity.Incident;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class IncidentEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    public void publishIncidentReported(Incident incident) {
        IncidentReportedEvent event = new IncidentReportedEvent(
                "incident-service",
                incident.getId(),
                incident.getTripId(),
                incident.getDriverId(),
                incident.getSeverity().name(),
                incident.getIncidentType().name()
        );
        try {
            rabbitTemplate.convertAndSend("fleettrack.events", "incident.reported", event);
        } catch (AmqpException ex) {
            log.warn("Failed to publish incident reported event for incident {}", incident.getId(), ex);
        }
    }
}
