package com.fleettrack.events;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class IncidentReportedEvent extends BaseEvent {

    private Long incidentId;
    private Long tripId;
    private Long driverId;
    private String severity;
    private String incidentType;

    public IncidentReportedEvent(String sourceService, Long incidentId, Long tripId,
                                 Long driverId, String severity, String incidentType) {
        super("incident.reported", sourceService);
        this.incidentId = incidentId;
        this.tripId = tripId;
        this.driverId = driverId;
        this.severity = severity;
        this.incidentType = incidentType;
    }
}
