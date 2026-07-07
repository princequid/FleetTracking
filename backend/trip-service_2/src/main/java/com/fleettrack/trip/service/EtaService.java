package com.fleettrack.trip.service;

import com.fleettrack.trip.model.dto.StopRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Slf4j
public class EtaService {

    @Value("${osrm.base-url:http://localhost:5000}")
    private String osrmBaseUrl;

    // Plain RestTemplate — not @LoadBalanced, so it can call external IPs directly.
    private final RestTemplate restTemplate = new RestTemplate();

    /**
     * Calls OSRM to get the driving duration for origin → stops → destination.
     * Returns the estimated arrival Instant, or empty if OSRM is unreachable or
     * any coordinate is null.
     */
    public Optional<Instant> calculateEta(
            BigDecimal originLat, BigDecimal originLng,
            List<StopRequest> stops,
            BigDecimal destLat,   BigDecimal destLng) {

        if (originLat == null || originLng == null || destLat == null || destLng == null) {
            return Optional.empty();
        }

        StringBuilder coords = new StringBuilder();
        coords.append(originLng).append(",").append(originLat);

        if (stops != null) {
            for (StopRequest s : stops) {
                if (s.getLat() != null && s.getLng() != null) {
                    coords.append(";").append(s.getLng()).append(",").append(s.getLat());
                }
            }
        }

        coords.append(";").append(destLng).append(",").append(destLat);

        String url = osrmBaseUrl + "/route/v1/driving/" + coords + "?overview=false";

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> body = restTemplate.getForObject(url, Map.class);
            if (body == null || !"Ok".equals(body.get("code"))) return Optional.empty();

            @SuppressWarnings("unchecked")
            List<Map<String, Object>> routes = (List<Map<String, Object>>) body.get("routes");
            if (routes == null || routes.isEmpty()) return Optional.empty();

            double durationSecs = ((Number) routes.get(0).get("duration")).doubleValue();
            return Optional.of(Instant.now().plusSeconds((long) durationSecs));
        } catch (Exception e) {
            log.warn("OSRM ETA call failed ({}): {}", url, e.getMessage());
            return Optional.empty();
        }
    }
}
