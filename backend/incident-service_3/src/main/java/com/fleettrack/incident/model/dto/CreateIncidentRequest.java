package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentType;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateIncidentRequest {

    @NotNull
    private Long tripId;

    @NotNull
    private Long driverId;

    @NotNull
    private IncidentType incidentType;

    @NotNull
    private IncidentSeverity severity;

    private String description;
}
