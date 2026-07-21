package com.fleettrack.driver.model.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class DriverStatsResponse {
    private Long driverId;
    private Integer totalTrips;
    private Integer onTimeTrips;
    // 0-100, or null if the driver has no completed trips yet (no data, not "0%").
    private Integer onTimePercent;
    // 1.0-5.0, derived from onTimePercent (see DriverService.getDriverStats) — null
    // under the same "no completed trips yet" condition as onTimePercent.
    private Double rating;
}
