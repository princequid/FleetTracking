package com.fleettrack.trip.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class DriverResponse {
    private Long id;
    private Long userId;
    private String fullName;
    private Boolean isActive;
}
