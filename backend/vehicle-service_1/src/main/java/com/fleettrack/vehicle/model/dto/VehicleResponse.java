package com.fleettrack.vehicle.model.dto;

import com.fleettrack.vehicle.model.enums.VehicleStatus;
import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;
import java.time.Instant;

@Getter @Builder
public class VehicleResponse {
    private Long id;
    private String plateNumber;
    private String model;
    private BigDecimal capacity;
    private VehicleStatus status;
    private Instant createdAt;
    private Instant updatedAt;
}
