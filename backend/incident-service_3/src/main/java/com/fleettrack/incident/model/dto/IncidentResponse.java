package com.fleettrack.incident.model.dto;

import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.model.enums.IncidentType;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;

@Getter
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
    private OffsetDateTime resolvedAt;
    private OffsetDateTime createdAt;
}
