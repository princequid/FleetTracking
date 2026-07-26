package com.fleettrack.gps.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Minimal mirror of trip-service's TripResponse — only the fields gps-service needs
// to verify a driver actually owns the trip they're pinging/reading. Spring's default
// Jackson config ignores the extra fields on the real response.
@Getter
@Setter
@NoArgsConstructor
public class TripOwnerResponse {
    private Long id;
    private Long driverId;
}
