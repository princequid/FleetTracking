package com.fleettrack.trip.model.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
public class TripStatusHistoryResponse {
    private String oldStatus;
    private String newStatus;
    private Long changedBy;
    private Instant changedAt;
}
