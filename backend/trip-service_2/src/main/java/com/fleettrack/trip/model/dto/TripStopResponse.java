package com.fleettrack.trip.model.dto;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class TripStopResponse {
    private Long id;
    private Integer stopOrder;
    private String name;
    private BigDecimal lat;
    private BigDecimal lng;
    private String description;
}
