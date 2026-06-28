package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateStatusRequest {

    @NotNull
    private IncidentStatus status;

    private String resolutionNotes;
}
