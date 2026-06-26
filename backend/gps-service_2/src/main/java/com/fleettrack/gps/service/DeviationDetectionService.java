package com.fleettrack.gps.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.events.TripDeviatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviationDetectionService {

    private final RestTemplate restTemplate;
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final StringRedisTemplate redisTemplate;

    private static final String EXCHANGE = "fleettrack.events";
    private static final double DEVIATION_THRESHOLD_M = 500.0;

    public void checkDeviation(Long tripId, Long driverId, Double currentLat, Double currentLng) {
        try {
            Map<?, ?> trip = restTemplate.getForObject(
                    "http://trip-service/" + tripId, Map.class);

            if (trip == null || trip.get("routeGeometry") == null) return;

            String routeJson = (String) trip.get("routeGeometry");
            double minDistance = findMinDistanceToRoute(currentLat, currentLng, routeJson);

            if (minDistance <= DEVIATION_THRESHOLD_M) {
                redisTemplate.delete("deviation:consecutive:" + tripId);
                return;
            }

            String counterKey = "deviation:consecutive:" + tripId;
            Long count = redisTemplate.opsForValue().increment(counterKey);
            redisTemplate.expire(counterKey, Duration.ofMinutes(5));

            if (count != null && count >= 2) {
                log.warn("Deviation detected for trip {} — {}m off route, {} consecutive", tripId, minDistance, count);
                TripDeviatedEvent event = new TripDeviatedEvent(
                        "gps-service", tripId, driverId, currentLat, currentLng, minDistance);
                rabbitTemplate.convertAndSend(EXCHANGE, "trip.deviated", event);
                redisTemplate.delete(counterKey);
            }
        } catch (Exception e) {
            log.debug("Deviation check skipped for trip {}: {}", tripId, e.getMessage());
        }
    }

    private double findMinDistanceToRoute(Double lat, Double lng, String routeJson) {
        try {
            JsonNode root = objectMapper.readTree(routeJson);
            JsonNode coordinates = root.path("coordinates");
            if (!coordinates.isArray() || coordinates.isEmpty()) return 0;

            double minDist = Double.MAX_VALUE;
            for (JsonNode coord : coordinates) {
                if (coord.isArray() && coord.size() >= 2) {
                    double rLng = coord.get(0).asDouble();
                    double rLat = coord.get(1).asDouble();
                    double dist = PlausibilityCheckService.haversine(lat, lng, rLat, rLng);
                    minDist = Math.min(minDist, dist);
                }
            }
            return minDist;
        } catch (Exception e) {
            log.debug("Failed to parse route geometry: {}", e.getMessage());
            return 0;
        }
    }
}
