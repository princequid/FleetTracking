package com.fleettrack.incident.controller;

import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.UpdateIncidentStatusRequest;
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

    private static final List<String> CREATE_ROLES = List.of("DRIVER", "ADMIN", "SUPER_ADMIN");
    private static final List<String> LIST_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> STATUS_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(
            @Valid @RequestBody CreateIncidentRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, CREATE_ROLES);
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.reportIncident(request, driverId));
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponse>> getIncidents(
            @RequestParam(required = false) IncidentStatus status,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, LIST_ROLES);
        return ResponseEntity.ok(incidentService.getAllIncidents(status));
    }

    @GetMapping("/trips/{tripId}")
    public ResponseEntity<List<IncidentResponse>> getIncidentsByTrip(
            @PathVariable Long tripId, HttpServletRequest httpRequest) {
        requireRole(httpRequest, LIST_ROLES);
        return ResponseEntity.ok(incidentService.getIncidentsByTrip(tripId));
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidentResponse> getIncidentById(
            @PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, LIST_ROLES);
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<IncidentResponse> updateStatus(
            @PathVariable Long id,
            @Valid @RequestBody UpdateIncidentStatusRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, STATUS_ROLES);
        Long adminUserId = extractUserId(httpRequest);
        return ResponseEntity.ok(incidentService.updateStatus(id, request, adminUserId));
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header.trim());
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
