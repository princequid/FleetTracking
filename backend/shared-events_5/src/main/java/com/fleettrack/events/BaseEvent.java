package com.fleettrack.events;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class BaseEvent {

    private UUID eventId;
    private String eventType;
    private Instant occurredAt;
    private String sourceService;
    private String organisationId;

    public BaseEvent(String eventType, String sourceService) {
        this.eventId = UUID.randomUUID();
        this.eventType = eventType;
        this.occurredAt = Instant.now();
        this.sourceService = sourceService;
        this.organisationId = "fleettrack";
    }
}
