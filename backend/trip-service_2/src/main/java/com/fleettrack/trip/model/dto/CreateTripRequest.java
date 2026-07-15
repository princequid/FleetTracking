package com.fleettrack.trip.model.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
    private String description;
    private Double originLat;
    private Double originLng;
    private Double destLat;
    private Double destLng;

    /** Optional ordered waypoints between origin and destination (max 7). */
    @Valid
    @Size(max = 7, message = "A trip may have at most 7 stops")
    private List<StopRequest> stops;
}
