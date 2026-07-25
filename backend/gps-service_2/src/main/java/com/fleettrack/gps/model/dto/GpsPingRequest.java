package com.fleettrack.gps.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class GpsPingRequest {

    @NotNull
    private Double lat;

    @NotNull
    private Double lng;

    private Double speedKmh;
    private Double heading;
    private Double accuracyM;

    @NotNull
    private Instant recordedAt;
}
