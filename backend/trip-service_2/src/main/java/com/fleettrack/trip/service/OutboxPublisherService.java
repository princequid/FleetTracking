package com.fleettrack.trip.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.trip.model.entity.OutboxEvent;
import com.fleettrack.trip.repository.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OutboxPublisherService {

    private final OutboxEventRepository outboxEventRepository;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;

    private static final String EXCHANGE = "fleettrack.events";

    @Transactional
    public void saveToOutbox(String eventType, Object payload) {
        try {
            String json = objectMapper.writeValueAsString(payload);
            OutboxEvent event = OutboxEvent.builder()
                    .eventType(eventType)
                    .payload(json)
                    .build();
            outboxEventRepository.save(event);
            log.debug("Saved outbox event: {}", eventType);
        } catch (Exception e) {
            log.error("Failed to save outbox event: {}", eventType, e);
            throw new RuntimeException("Failed to save outbox event", e);
        }
    }

    @Scheduled(fixedDelay = 30000)
    @Transactional
    public void retryUnpublished() {
        List<OutboxEvent> pending = outboxEventRepository.findByPublishedFalseOrderByCreatedAtAsc();
        if (pending.isEmpty()) return;

        log.debug("Retrying {} unpublished outbox events", pending.size());
        for (OutboxEvent event : pending) {
            event.setAttempts(event.getAttempts() + 1);
            try {
                rabbitTemplate.convertAndSend(EXCHANGE, event.getEventType(), event.getPayload());
                event.setPublished(true);
                log.debug("Published outbox event id={} type={}", event.getId(), event.getEventType());
            } catch (Exception e) {
                log.warn("Failed to publish outbox event id={} (attempt {})", event.getId(), event.getAttempts(), e);
            }
            outboxEventRepository.save(event);
        }
    }
}
