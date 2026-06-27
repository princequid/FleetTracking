package com.fleettrack.gps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.gps.model.dto.GpsPingRequest;
import com.fleettrack.gps.model.dto.GpsPingResponse;
import com.fleettrack.gps.model.entity.GpsPing;
import com.fleettrack.gps.repository.GpsPingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class GpsService {

    private final GpsPingRepository gpsPingRepository;
    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final PlausibilityCheckService plausibilityCheckService;
    private final DeviationDetectionService deviationDetectionService;

    @Transactional
    public GpsPingResponse savePing(Long tripId, GpsPingRequest request, Long driverId) {
        if (request.getAccuracyM() != null && request.getAccuracyM() > 50) {
            throw new RuntimeException("Ping discarded — accuracy too low (" + request.getAccuracyM() + "m)");
        }

        GpsPing ping = GpsPing.builder()
                .tripId(tripId)
                .driverId(driverId)
                .lat(BigDecimal.valueOf(request.getLat()))
                .lng(BigDecimal.valueOf(request.getLng()))
                .speedKmh(toBigDecimal(request.getSpeedKmh()))
                .heading(toBigDecimal(request.getHeading()))
                .accuracyM(toBigDecimal(request.getAccuracyM()))
                .recordedAt(request.getRecordedAt())
                .build();

        GpsPing savedPing = gpsPingRepository.save(ping);

        gpsPingRepository.findFirstByTripIdAndRecordedAtBeforeOrderByRecordedAtDesc(tripId, savedPing.getRecordedAt())
                .ifPresent(previousPing -> {
                    String flag = plausibilityCheckService.checkPing(savedPing, previousPing);
                    if (flag != null) {
                        savedPing.setValidationFlag(flag);
                        gpsPingRepository.save(savedPing);
                        log.warn("Ping {} flagged: {}", savedPing.getId(), flag);
                    }
                });

        deviationDetectionService.checkDeviation(tripId, driverId,
                request.getLat(), request.getLng());

        GpsPingResponse response = mapToResponse(savedPing);
        publishToRedis(tripId, response);
        return response;
    }

    @Transactional
    public List<GpsPingResponse> saveBulkPings(Long tripId, List<GpsPingRequest> requests, Long driverId) {
        return requests.stream()
                .map(req -> {
                    GpsPing ping = GpsPing.builder()
                            .tripId(tripId)
                            .driverId(driverId)
                            .lat(BigDecimal.valueOf(req.getLat()))
                            .lng(BigDecimal.valueOf(req.getLng()))
                            .speedKmh(toBigDecimal(req.getSpeedKmh()))
                            .heading(toBigDecimal(req.getHeading()))
                            .accuracyM(toBigDecimal(req.getAccuracyM()))
                            .recordedAt(req.getRecordedAt())
                            .isOfflinePing(true)
                            .build();
                    return mapToResponse(gpsPingRepository.save(ping));
                })
                .toList();
    }

    public List<GpsPingResponse> getRoute(Long tripId) {
        return gpsPingRepository.findByTripIdOrderByRecordedAtAsc(tripId).stream()
                .map(this::mapToResponse)
                .toList();
    }

    public GpsPingResponse getLatestPing(Long tripId) {
        return gpsPingRepository.findFirstByTripIdOrderByRecordedAtDesc(tripId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("No pings found for trip " + tripId));
    }

    public List<GpsPingResponse> getActivePositions() {
        Set<String> keys = redisTemplate.keys("trip:latest-ping:*");
        if (keys == null || keys.isEmpty()) return List.of();

        List<GpsPingResponse> positions = new ArrayList<>();
        for (String key : keys) {
            try {
                String json = redisTemplate.opsForValue().get(key);
                if (json != null) {
                    positions.add(objectMapper.readValue(json, GpsPingResponse.class));
                }
            } catch (Exception e) {
                log.warn("Failed to read Redis key {}", key, e);
            }
        }
        return positions;
    }

    private void publishToRedis(Long tripId, GpsPingResponse response) {
        try {
            String json = objectMapper.writeValueAsString(response);
            redisTemplate.convertAndSend("trips:" + tripId + ":location", json);
            redisTemplate.opsForValue().set("trip:latest-ping:" + tripId, json, Duration.ofMinutes(30));
            log.debug("Published ping to Redis for trip {}", tripId);
        } catch (Exception e) {
            log.warn("Failed to publish to Redis for trip {}", tripId, e);
        }
    }

    private GpsPingResponse mapToResponse(GpsPing ping) {
        return GpsPingResponse.builder()
                .id(ping.getId())
                .tripId(ping.getTripId())
                .driverId(ping.getDriverId())
                .lat(ping.getLat())
                .lng(ping.getLng())
                .speedKmh(ping.getSpeedKmh())
                .heading(ping.getHeading())
                .accuracyM(ping.getAccuracyM())
                .recordedAt(ping.getRecordedAt())
                .receivedAt(ping.getReceivedAt())
                .isOfflinePing(ping.getIsOfflinePing())
                .validationFlag(ping.getValidationFlag())
                .build();
    }

    private BigDecimal toBigDecimal(Double value) {
        return value != null ? BigDecimal.valueOf(value) : null;
    }
}
