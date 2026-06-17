package com.fleettrack.driver.model.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DriverStatsResponse {
    private Long driverId;
    private String fullName;
    private Integer totalTrips;
    private Integer onTimeTrips;
    private Integer incidentCount;
    private Double performanceScore;
}
