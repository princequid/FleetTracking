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
}
