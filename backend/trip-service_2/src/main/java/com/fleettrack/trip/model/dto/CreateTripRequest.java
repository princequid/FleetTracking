package com.fleettrack.trip.model.dto;

import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateTripRequest {

    @NotNull
    private Long driverId;

    @NotNull
    private Long vehicleId;

    private String origin;
    private String destination;
    private Double originLat;
    private Double originLng;
    private Double destLat;
    private Double destLng;

    /** Optional ordered waypoints between origin and destination (max 7). */
    private List<StopRequest> stops;
}
