package com.fleettrack.trip.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class StopRequest {
    private String name;
    private Double lat;
    private Double lng;
    private String description;
}
