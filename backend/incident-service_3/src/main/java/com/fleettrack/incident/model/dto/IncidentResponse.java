package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.model.enums.IncidentType;
import lombok.Builder;
<<<<<<< HEAD
import lombok.Data;

import java.time.Instant;

@Data
=======
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
@Builder
public class IncidentResponse {
    private Long id;
    private Long tripId;
    private Long driverId;
    private IncidentType incidentType;
    private IncidentSeverity severity;
    private String description;
    private IncidentStatus status;
    private Long reviewedBy;
    private String resolutionNotes;
<<<<<<< HEAD
    private Instant resolvedAt;
    private Instant createdAt;
=======
    private OffsetDateTime resolvedAt;
    private OffsetDateTime createdAt;
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
}
