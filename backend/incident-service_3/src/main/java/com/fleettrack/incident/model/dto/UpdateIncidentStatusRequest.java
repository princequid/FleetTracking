package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateIncidentStatusRequest {

    @NotNull
    private IncidentStatus status;

    private String resolutionNotes;
}
