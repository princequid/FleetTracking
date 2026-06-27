package com.fleettrack.incident.controller;

import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentType;
import com.fleettrack.incident.service.IncidentService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class IncidentControllerTest {

    private final IncidentService incidentService = mock(IncidentService.class);
    private final IncidentController controller = new IncidentController(incidentService);

    @Test
    void createIncidentReturnsBadRequestWhenUserIdHeaderIsNotNumeric() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-User-Id", "tester");
        request.addHeader("X-User-Role", "DRIVER");

        CreateIncidentRequest incidentRequest = new CreateIncidentRequest();
        incidentRequest.setTripId(1L);
        incidentRequest.setIncidentType(IncidentType.ACCIDENT);
        incidentRequest.setSeverity(IncidentSeverity.HIGH);
        incidentRequest.setDescription("Brake failure");

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> controller.createIncident(incidentRequest, request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
    }
}
