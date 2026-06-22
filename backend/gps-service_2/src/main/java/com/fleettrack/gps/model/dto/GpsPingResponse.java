package com.fleettrack.gps.model.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.Instant;

@Getter
@Builder
public class GpsPingResponse {
    private Long id;
    private Long tripId;
    private Long driverId;
    private BigDecimal lat;
    private BigDecimal lng;
    private BigDecimal speedKmh;
    private BigDecimal heading;
    private BigDecimal accuracyM;
    private Instant recordedAt;
    private Instant receivedAt;
    private Boolean isOfflinePing;
    private String validationFlag;
}
