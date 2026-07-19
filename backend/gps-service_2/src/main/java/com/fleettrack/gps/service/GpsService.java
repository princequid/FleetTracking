package com.fleettrack.gps.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fleettrack.gps.model.dto.GpsPingRequest;
import com.fleettrack.gps.model.dto.GpsPingResponse;
import com.fleettrack.gps.model.entity.GpsPing;
import com.fleettrack.gps.repository.GpsPingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.RedisCallback;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
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

    // Cap for GET /trips/{tripId}/route — protects against pulling a trip's entire,
    // unbounded ping history into memory in one response.
    private static final int DEFAULT_ROUTE_LIMIT = 1000;
    private static final int MAX_ROUTE_LIMIT = 5000;

    @Transactional
    public GpsPingResponse savePing(Long tripId, GpsPingRequest request, Long driverId) {
        if (request.getAccuracyM() != null && request.getAccuracyM() > 50) {
            throw new RuntimeException("Ping discarded — accuracy too low (" + request.getAccuracyM() + "m)");
        }
        return processPing(tripId, request, driverId, false);
    }

    // Runs the same plausibility-check / deviation-detection / Redis-publish path as
    // savePing for every ping in the batch (single shared helper, single surrounding
    // @Transactional for the whole batch — not a per-ping transaction, and not a loop
    // calling savePing(), which would re-open a transaction per ping).
    @Transactional
    public List<GpsPingResponse> saveBulkPings(Long tripId, List<GpsPingRequest> requests, Long driverId) {
        return requests.stream()
                .map(req -> processPing(tripId, req, driverId, true))
                .toList();
    }

    private GpsPingResponse processPing(Long tripId, GpsPingRequest request, Long driverId, boolean isOfflinePing) {
        GpsPing ping = GpsPing.builder()
                .tripId(tripId)
                .driverId(driverId)
                .lat(BigDecimal.valueOf(request.getLat()))
                .lng(BigDecimal.valueOf(request.getLng()))
                .speedKmh(toBigDecimal(request.getSpeedKmh()))
                .heading(toBigDecimal(request.getHeading()))
                .accuracyM(toBigDecimal(request.getAccuracyM()))
                .recordedAt(request.getRecordedAt())
                .isOfflinePing(isOfflinePing)
                .build();

        GpsPing savedPing = gpsPingRepository.save(ping);

        String flag = gpsPingRepository
                .findFirstByTripIdAndRecordedAtBeforeOrderByRecordedAtDesc(tripId, savedPing.getRecordedAt())
                .map(previousPing -> plausibilityCheckService.checkPing(savedPing, previousPing))
                .orElse(null);
        if (flag != null) {
            savedPing.setValidationFlag(flag);
            gpsPingRepository.save(savedPing);
            log.warn("Ping {} flagged: {}", savedPing.getId(), flag);
        }

        deviationDetectionService.checkDeviation(tripId, driverId,
                request.getLat(), request.getLng());

        GpsPingResponse response = mapToResponse(savedPing);

        // Every ping is saved to the DB regardless (route history/audit trail is
        // complete either way), but only surface it as the trip's *live* position if
        // it isn't a flagged implausible jump AND it's actually newer than whatever
        // is currently cached as "latest" for this trip. Without the recency check, a
        // replayed offline ping (mobile queues failed pings and resends them later,
        // with their original timestamp, whenever the trip screen regains focus) —
        // or any other out-of-order delivery — would overwrite a legitimately newer
        // position and snap the live map backward to a stale point.
        if (flag == null && isNewerThanCachedLatest(tripId, savedPing.getRecordedAt())) {
            publishToRedis(tripId, response);
        }
        return response;
    }

    private boolean isNewerThanCachedLatest(Long tripId, java.time.Instant recordedAt) {
        try {
            String json = redisTemplate.opsForValue().get("trip:latest-ping:" + tripId);
            if (json == null) return true;
            GpsPingResponse cached = objectMapper.readValue(json, GpsPingResponse.class);
            return cached.getRecordedAt() == null || recordedAt.isAfter(cached.getRecordedAt());
        } catch (Exception e) {
            log.warn("Failed to read cached latest ping for trip {}", tripId, e);
            return true; // fail open — a Redis read hiccup shouldn't block live updates
        }
    }

    public List<GpsPingResponse> getRoute(Long tripId, Integer limit) {
        int cap = (limit != null && limit > 0) ? Math.min(limit, MAX_ROUTE_LIMIT) : DEFAULT_ROUTE_LIMIT;
        List<GpsPing> pings = gpsPingRepository
                .findByTripIdOrderByRecordedAtDesc(tripId, PageRequest.of(0, cap))
                .getContent();
        Collections.reverse(pings); // restore chronological (ascending) order for the route timeline
        return pings.stream().map(this::mapToResponse).toList();
    }

    public GpsPingResponse getLatestPing(Long tripId) {
        return gpsPingRepository.findFirstByTripIdOrderByRecordedAtDesc(tripId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("No pings found for trip " + tripId));
    }

    public List<GpsPingResponse> getActivePositions() {
        Set<String> keys = scanKeys("trip:latest-ping:*");
        if (keys.isEmpty()) return List.of();

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

    // Non-blocking cursor-based SCAN instead of KEYS — KEYS is an O(N) blocking scan of
    // the entire keyspace and can stall Redis under load; SCAN walks it incrementally.
    private Set<String> scanKeys(String pattern) {
        Set<String> keys = new HashSet<>();
        ScanOptions options = ScanOptions.scanOptions().match(pattern).count(200).build();
        redisTemplate.execute((RedisCallback<Object>) connection -> {
            try (Cursor<byte[]> cursor = connection.scan(options)) {
                while (cursor.hasNext()) {
                    keys.add(new String(cursor.next(), StandardCharsets.UTF_8));
                }
            }
            return null;
        });
        return keys;
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
