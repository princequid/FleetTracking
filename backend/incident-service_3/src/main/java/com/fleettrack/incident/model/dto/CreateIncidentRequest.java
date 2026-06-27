package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateIncidentRequest {

    @NotNull
    private Long tripId;

    @NotNull
    private IncidentType incidentType;

    @NotNull
    private IncidentSeverity severity;

    @Size(max = 1000)
    private String description;
}
