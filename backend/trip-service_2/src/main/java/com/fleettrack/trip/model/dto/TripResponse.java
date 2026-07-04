package com.fleettrack.trip.model.dto;

import com.fleettrack.trip.model.enums.TripStatus;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Getter
@Builder
public class TripResponse {
    private Long id;
    private Long driverId;
    private Long vehicleId;
    private String origin;
    private String destination;
    private BigDecimal originLat;
    private BigDecimal originLng;
    private BigDecimal destLat;
    private BigDecimal destLng;
    private List<TripStopResponse> stops;
    private TripStatus status;
    private Instant eta;
    private String routeGeometry;
    private Instant createdAt;
    private Instant startedAt;
    private Instant arrivedAt;
    private Instant completedAt;
    private Instant cancelledAt;
}
