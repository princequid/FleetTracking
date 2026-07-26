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
import java.util.ArrayList;
import java.util.List;
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
            Double minDistance = findMinDistanceToRoute(currentLat, currentLng, routeJson);

            if (minDistance == null) {
                // Route geometry couldn't be evaluated (unparseable / empty coordinates) —
                // fail safe by skipping this check rather than concluding "on route".
                log.debug("Skipping deviation check for trip {} — route geometry could not be evaluated", tripId);
                return;
            }

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

    /**
     * Returns the minimum distance (meters) from (lat,lng) to the route, measured against
     * each route *segment* (not just each vertex), or {@code null} if the route geometry
     * can't be evaluated (unparseable JSON, missing/empty coordinates). Callers MUST treat
     * a null return as "cannot evaluate" and skip the deviation check — never interpret it
     * as "on route", which would silently suppress deviation detection for that trip.
     */
    private Double findMinDistanceToRoute(Double lat, Double lng, String routeJson) {
        try {
            JsonNode root = objectMapper.readTree(routeJson);
            JsonNode coordinates = root.path("coordinates");
            if (!coordinates.isArray() || coordinates.isEmpty()) {
                log.debug("Route geometry has no coordinates — cannot evaluate deviation");
                return null;
            }

            List<double[]> points = new ArrayList<>();
            for (JsonNode coord : coordinates) {
                if (coord.isArray() && coord.size() >= 2) {
                    // GeoJSON coordinates are [lng, lat]
                    points.add(new double[] { coord.get(1).asDouble(), coord.get(0).asDouble() });
                }
            }
            if (points.isEmpty()) {
                log.debug("Route geometry coordinates were all malformed — cannot evaluate deviation");
                return null;
            }
            if (points.size() == 1) {
                double[] p = points.get(0);
                return PlausibilityCheckService.haversine(lat, lng, p[0], p[1]);
            }

            double minDist = Double.MAX_VALUE;
            for (int i = 0; i < points.size() - 1; i++) {
                double[] a = points.get(i);
                double[] b = points.get(i + 1);
                double dist = pointToSegmentDistanceMeters(lat, lng, a[0], a[1], b[0], b[1]);
                minDist = Math.min(minDist, dist);
            }
            return minDist;
        } catch (Exception e) {
            log.debug("Failed to parse route geometry: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Perpendicular distance in meters from (lat,lng) to the segment
     * (lat1,lng1)-(lat2,lng2), clamping the projection to [0,1] so points beyond the
     * segment's ends measure to the nearest endpoint rather than the infinite line.
     * Uses a local equirectangular (flat-earth) projection centered on the segment —
     * accurate enough at route-segment scale (tens to low-hundreds of meters) without
     * the complexity of full great-circle cross-track-distance math.
     */
    private double pointToSegmentDistanceMeters(double lat, double lng,
                                                 double lat1, double lng1,
                                                 double lat2, double lng2) {
        double refLatRad = Math.toRadians((lat1 + lat2) / 2.0);
        double metersPerDegLat = 111_320.0;
        double metersPerDegLng = 111_320.0 * Math.cos(refLatRad);

        // Project onto a local Cartesian plane with segment start (lat1,lng1) as the origin.
        double x0 = (lng - lng1) * metersPerDegLng;
        double y0 = (lat - lat1) * metersPerDegLat;
        double x2 = (lng2 - lng1) * metersPerDegLng;
        double y2 = (lat2 - lat1) * metersPerDegLat;

        double segLenSq = x2 * x2 + y2 * y2;
        double t = segLenSq == 0 ? 0 : (x0 * x2 + y0 * y2) / segLenSq;
        t = Math.max(0, Math.min(1, t));

        double projX = t * x2;
        double projY = t * y2;

        double dx = x0 - projX;
        double dy = y0 - projY;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
