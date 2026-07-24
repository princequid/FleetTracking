package com.fleettrack.notification.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.notification.config.RabbitMQConfig;
import com.fleettrack.notification.model.enums.NotificationType;
import com.fleettrack.notification.service.NotificationService;
import com.rabbitmq.client.Channel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

/**
 * Consumes trip lifecycle events off the shared exchange and turns them into
 * in-app notifications addressed to the driver. Reads the raw JSON body into a
 * Map so it works whether the event was published as an object (direct publish)
 * or as a JSON string (transactional outbox).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TripEventConsumer {

    private final NotificationService notificationService;
    private final ObjectMapper objectMapper;

    @RabbitListener(queues = RabbitMQConfig.NOTIFICATION_QUEUE)
    public void handleEvent(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        try {
            String routingKey = message.getMessageProperties().getReceivedRoutingKey();
            String body = new String(message.getBody());

            // Outbox may double-encode (a JSON string containing JSON) — unwrap once if so
            Object parsed = objectMapper.readValue(body, Object.class);
            Map<String, Object> payload = (parsed instanceof String)
                    ? objectMapper.readValue((String) parsed, Map.class)
                    : objectMapper.convertValue(parsed, Map.class);

            String eventType = str(payload.getOrDefault("eventType", routingKey));
            UUID eventId     = parseUuid(payload.get("eventId"));
            Long driverId    = parseLong(payload.get("driverId"));
            Long tripId      = parseLong(payload.get("tripId"));
            String origin    = str(payload.get("origin"));
            String dest      = str(payload.get("destination"));

            switch (eventType) {
                case "trip.assigned" -> notificationService.createFromEvent(
                        eventId, driverId, NotificationType.TRIP_ASSIGNED,
                        "New trip assigned",
                        routeText("New trip", origin, dest, tripId),
                        tripId);
                case "trip.started" -> notificationService.createFromEvent(
                        eventId, driverId, NotificationType.TRIP_STARTED,
                        "Trip started",
                        routeText("Trip started", origin, dest, tripId),
                        tripId);
                case "trip.cancelled" -> notificationService.createFromEvent(
                        eventId, driverId, NotificationType.TRIP_CANCELLED,
                        "Trip cancelled",
                        (tripId != null ? "Trip #" + tripId + " " : "") + "was cancelled by fleet management.",
                        tripId);
                case "trip.completed" -> notificationService.createFromEvent(
                        eventId, driverId, NotificationType.TRIP_DELIVERED,
                        "Trip completed",
                        (tripId != null ? "Trip #" + tripId + " " : "") + "was marked as delivered. Great job!",
                        tripId);
                case "trip.deviated" -> notificationService.createFromEvent(
                        eventId, driverId, NotificationType.TRIP_DEVIATED,
                        "You're off the planned route",
                        deviationText(payload.get("deviationMetres"), tripId),
                        tripId);
                default -> log.debug("Ignoring event type {}", eventType);
            }

            channel.basicAck(deliveryTag, false);
        } catch (Exception e) {
            log.error("Failed to process notification event, dropping", e);
            // Don't requeue — a malformed event would loop forever
            channel.basicNack(deliveryTag, false, false);
        }
    }

    private static String deviationText(Object deviationMetres, Long tripId) {
        String id = tripId != null ? "Trip #" + tripId : "Your trip";
        Long metres = parseLong(deviationMetres);
        return metres != null
                ? id + " has drifted " + metres + "m from the planned route."
                : id + " has drifted from the planned route.";
    }

    private static String routeText(String prefix, String origin, String dest, Long tripId) {
        String route = (origin != null && dest != null) ? origin + " → " + dest : "";
        String id = tripId != null ? "Trip #" + tripId : prefix;
        return route.isEmpty() ? id : id + " — " + route;
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static Long parseLong(Object o) {
        if (o instanceof Number n) return n.longValue();
        if (o instanceof String s && !s.isBlank()) {
            try { return Long.parseLong(s.trim()); } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private static UUID parseUuid(Object o) {
        if (o instanceof String s) {
            try { return UUID.fromString(s); } catch (Exception ignored) {}
        }
        return null;
    }
}
