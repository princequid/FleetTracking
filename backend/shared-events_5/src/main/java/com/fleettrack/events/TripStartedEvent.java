package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TripStartedEvent extends BaseEvent {

    private Long tripId;
    private Long driverId;
    private Long vehicleId;
    private String origin;
    private String destination;

    public TripStartedEvent(String sourceService, Long tripId, Long driverId,
                            Long vehicleId, String origin, String destination) {
        super("trip.started", sourceService);
        this.tripId = tripId;
        this.driverId = driverId;
        this.vehicleId = vehicleId;
        this.origin = origin;
        this.destination = destination;
    }
}
