package com.fleettrack.audit.listener;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.audit.model.entity.AuditLog;
import com.fleettrack.audit.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuditEventListener {

    private final AuditLogRepository auditLogRepository;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "audit-service.queue")
    public void handleEvent(Message message) {
        try {
            String routingKey = message.getMessageProperties().getReceivedRoutingKey();
            String body = new String(message.getBody());
            Map<String, Object> payload = objectMapper.readValue(body, Map.class);

            AuditLog auditLog = AuditLog.builder()
                    .eventType(routingKey)
                    .serviceName((String) payload.getOrDefault("sourceService", null))
                    .newValue(body)
                    .occurredAt(parseOccurredAt(payload))
                    .build();

            auditLogRepository.save(auditLog);
            log.debug("Audit log saved for event: {}", routingKey);
        } catch (Exception e) {
            log.error("Failed to process audit event", e);
        }
    }

    private Instant parseOccurredAt(Map<String, Object> payload) {
        Object occurredAt = payload.get("occurredAt");
        if (occurredAt instanceof String) {
            try {
                return Instant.parse((String) occurredAt);
            } catch (Exception ignored) {}
        }
        return Instant.now();
    }
}
