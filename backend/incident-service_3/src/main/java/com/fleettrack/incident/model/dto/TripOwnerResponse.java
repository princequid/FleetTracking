package com.fleettrack.incident.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Minimal mirror of trip-service's TripResponse — only the fields incident-service
// needs to verify a driver actually owns the trip they're reporting an incident against.
@Getter
@Setter
@NoArgsConstructor
public class TripOwnerResponse {
    private Long id;
    private Long driverId;
}
