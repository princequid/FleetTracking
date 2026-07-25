package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Getter
@Setter
@NoArgsConstructor
public class TripCompletedEvent extends BaseEvent {

    private Long tripId;
    private Long driverId;
    private Long vehicleId;
    private Instant completedAt;
    private Boolean onTime;

    public TripCompletedEvent(String sourceService, Long tripId, Long driverId,
                              Long vehicleId, Instant completedAt, Boolean onTime) {
        super("trip.completed", sourceService);
        this.tripId = tripId;
        this.driverId = driverId;
        this.vehicleId = vehicleId;
        this.completedAt = completedAt;
        this.onTime = onTime;
    }
}
