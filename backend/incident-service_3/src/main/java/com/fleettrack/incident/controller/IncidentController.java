package com.fleettrack.incident.controller;

import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateStatusRequest;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.service.IncidentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;

    private static final List<String> ALL_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> REVIEW_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(
            @Valid @RequestBody CreateIncidentRequest request, HttpServletRequest httpRequest) {
        requireRole(httpRequest, WRITE_ROLES);
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.createIncident(request));
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponse>> getIncidents(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long tripId,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);

        if (tripId != null) {
            return ResponseEntity.ok(incidentService.getIncidentsByTripId(tripId));
        }
        if (status != null) {
            return ResponseEntity.ok(incidentService.getIncidentsByStatus(
                    IncidentStatus.valueOf(status.toUpperCase())));
        }
        return ResponseEntity.ok(incidentService.getAllIncidents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(
            @PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<IncidentResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateStatusRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, REVIEW_ROLES);
        Long reviewerId = extractUserId(httpRequest);
        return ResponseEntity.ok(incidentService.updateStatus(id, request, reviewerId));
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        return header != null ? Long.parseLong(header) : null;
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
