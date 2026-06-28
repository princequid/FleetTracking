package com.fleettrack.audit.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.audit.model.entity.AuditLog;
import com.fleettrack.audit.model.entity.ProcessedEvent;
import com.fleettrack.audit.repository.AuditLogRepository;
import com.fleettrack.audit.repository.ProcessedEventRepository;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class WildcardEventConsumer {

    private final AuditLogRepository auditLogRepository;
    private final ProcessedEventRepository processedEventRepository;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = "audit-service.queue")
    @Transactional
    public void handleEvent(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            String routingKey = message.getMessageProperties().getReceivedRoutingKey();
            String body = new String(message.getBody());

            @SuppressWarnings("unchecked")
            Map<String, Object> payload = objectMapper.readValue(body, Map.class);

            UUID eventId = parseEventId(payload);
            if (eventId != null && processedEventRepository.existsByEventId(eventId)) {
                log.debug("Skipping duplicate event: {}", eventId);
                channel.basicAck(deliveryTag, false);
                return;
            }

            AuditLog auditLog = AuditLog.builder()
                    .eventType(payload.getOrDefault("eventType", routingKey).toString())
                    .serviceName((String) payload.getOrDefault("sourceService", null))
                    .newValue(body)
                    .occurredAt(parseOccurredAt(payload))
                    .build();

            auditLogRepository.save(auditLog);

            if (eventId != null) {
                processedEventRepository.save(ProcessedEvent.builder()
                        .eventId(eventId)
                        .build());
            }

            log.info("Audit log saved — event_type={}, source={}", auditLog.getEventType(), auditLog.getServiceName());
            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            log.error("Failed to process audit event, nacking", e);
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private UUID parseEventId(Map<String, Object> payload) {
        Object id = payload.get("eventId");
        if (id instanceof String) {
            try { return UUID.fromString((String) id); } catch (Exception ignored) {}
        }
        return null;
    }

    private Instant parseOccurredAt(Map<String, Object> payload) {
        Object val = payload.get("occurredAt");
        if (val instanceof String) {
            try { return Instant.parse((String) val); } catch (Exception ignored) {}
        } else if (val instanceof Number) {
            return Instant.ofEpochSecond(((Number) val).longValue());
        }
        return Instant.now();
    }
}
