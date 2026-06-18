package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TripDeviatedEvent extends BaseEvent {

    private Long tripId;
    private Long driverId;
    private Double currentLat;
    private Double currentLng;
    private Double deviationMetres;

    public TripDeviatedEvent(String sourceService, Long tripId, Long driverId,
                             Double currentLat, Double currentLng, Double deviationMetres) {
        super("trip.deviated", sourceService);
        this.tripId = tripId;
        this.driverId = driverId;
        this.currentLat = currentLat;
        this.currentLng = currentLng;
        this.deviationMetres = deviationMetres;
    }
}
