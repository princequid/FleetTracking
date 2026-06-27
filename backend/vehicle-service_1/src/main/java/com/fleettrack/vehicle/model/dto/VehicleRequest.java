package com.fleettrack.vehicle.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class VehicleRequest {
    @NotBlank private String plateNumber;
    private String model;
    private Double capacity;
}
