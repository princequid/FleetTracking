package com.fleettrack.driver.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Mirrors trip-service's DriverTripStatsResponse — the shape of GET
// http://trip-service/drivers/{driverId}/stats.
@Getter
@Setter
@NoArgsConstructor
public class TripStatsResponse {
    private long completedTrips;
    private long onTimeTrips;
}
