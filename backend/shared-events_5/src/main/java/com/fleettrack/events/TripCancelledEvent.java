package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class TripCancelledEvent extends BaseEvent {

    private Long tripId;
    private Long driverId;
    private Long vehicleId;
    private String origin;
    private String destination;

    public TripCancelledEvent(String sourceService, Long tripId, Long driverId,
                              Long vehicleId, String origin, String destination) {
        super("trip.cancelled", sourceService);
        this.tripId = tripId;
        this.driverId = driverId;
        this.vehicleId = vehicleId;
        this.origin = origin;
        this.destination = destination;
    }
}
