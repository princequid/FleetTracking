package com.fleettrack.trip.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class StopRequest {
    @NotBlank
    private String name;
    private Double lat;
    private Double lng;
    private String description;
}
