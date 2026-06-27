package com.fleettrack.incident.service;

import com.fleettrack.incident.event.IncidentEventPublisher;
import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.model.enums.IncidentType;
import com.fleettrack.incident.repository.IncidentRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class IncidentServiceTest {

    @Mock
    private IncidentRepository incidentRepository;

    @Mock
    private IncidentEventPublisher incidentEventPublisher;

    @InjectMocks
    private IncidentService incidentService;

    @Test
    void reportIncidentSavesOpenIncidentAndPublishesEvent() {
        CreateIncidentRequest request = new CreateIncidentRequest();
        request.setTripId(55L);
        request.setIncidentType(IncidentType.ACCIDENT);
        request.setSeverity(IncidentSeverity.HIGH);
        request.setDescription("Brake failure");

        Incident saved = Incident.builder()
                .id(101L)
                .tripId(55L)
                .driverId(10L)
                .incidentType(IncidentType.ACCIDENT)
                .severity(IncidentSeverity.HIGH)
                .description("Brake failure")
                .status(IncidentStatus.OPEN)
                .build();

        when(incidentRepository.save(any(Incident.class))).thenReturn(saved);

        var response = incidentService.reportIncident(request, 10L);

        assertEquals(IncidentStatus.OPEN, response.getStatus());
        assertEquals(10L, response.getDriverId());
        verify(incidentRepository).save(any(Incident.class));
        verify(incidentEventPublisher).publishIncidentReported(any());
    }
}
