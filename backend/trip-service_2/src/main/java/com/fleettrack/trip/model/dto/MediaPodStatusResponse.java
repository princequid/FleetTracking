package com.fleettrack.trip.model.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class MediaPodStatusResponse {
    private Long tripId;
    private Boolean hasPOD;
    private Boolean hasPreDispatch;
    // Geotag of the POD photo itself (if any) — used to verify it was captured near
    // the destination before a trip can be completed.
    private Double lat;
    private Double lng;
}
