package com.fleettrack.auth.event;

import com.fleettrack.events.BaseEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class AuthEventPublisher {

    private final RabbitTemplate rabbitTemplate;

    private static final String EXCHANGE = "fleettrack.events";

    public void publishEvent(BaseEvent event, String routingKey) {
        log.debug("Publishing event {} with routing key {}", event.getEventType(), routingKey);
        rabbitTemplate.convertAndSend(EXCHANGE, routingKey, event);
    }
}
