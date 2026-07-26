package com.fleettrack.media.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

// Minimal mirror of trip-service's TripResponse — only the fields media-service
// needs to verify a driver actually owns the trip they're uploading a photo for.
// Spring's default Jackson config ignores the extra fields on the real response.
@Getter
@Setter
@NoArgsConstructor
public class TripResponse {
    private Long id;
    private Long driverId;
}
