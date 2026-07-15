package com.fleettrack.media.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Minimal mirror of driver-service's DriverProfileResponse — only the driver-profile
// id is needed to map the authenticated caller's X-User-Id (auth-service user id)
// onto the id trips (and therefore photo ownership) are keyed by.
@Getter
@Setter
@NoArgsConstructor
public class DriverResponse {
    private Long id;
}
