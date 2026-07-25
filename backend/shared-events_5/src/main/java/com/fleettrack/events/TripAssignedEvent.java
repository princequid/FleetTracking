package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class TripAssignedEvent extends BaseEvent {

    private Long tripId;
    private Long driverId;
    private Long vehicleId;
    private String origin;
    private String destination;
    private Instant eta;

    public TripAssignedEvent(String sourceService, Long tripId, Long driverId,
                             Long vehicleId, String origin, String destination, Instant eta) {
        super("trip.assigned", sourceService);
        this.tripId = tripId;
        this.driverId = driverId;
        this.vehicleId = vehicleId;
        this.origin = origin;
        this.destination = destination;
        this.eta = eta;
    }
}
