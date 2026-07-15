package com.fleettrack.trip.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Driver's current GPS fix, sent when starting a trip or confirming arrival, so the
// backend can verify the driver is actually near the relevant waypoint (geofencing).
@Getter
@Setter
@NoArgsConstructor
public class LocationRequest {
    private Double lat;
    private Double lng;
}
