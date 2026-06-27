package com.fleettrack.incident.controller;

import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.IncidentResponse;
<<<<<<< HEAD
import com.fleettrack.incident.model.dto.UpdateIncidentStatusRequest;
=======
import com.fleettrack.incident.model.dto.UpdateStatusRequest;
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
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

<<<<<<< HEAD
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
=======
    private static final List<String> ALL_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> REVIEW_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(
            @Valid @RequestBody CreateIncidentRequest request, HttpServletRequest httpRequest) {
        requireRole(httpRequest, WRITE_ROLES);
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.createIncident(request));
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponse>> getIncidents(
<<<<<<< HEAD
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
=======
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
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
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
<<<<<<< HEAD
            @Valid @RequestBody UpdateIncidentStatusRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, STATUS_ROLES);
        Long adminUserId = extractUserId(httpRequest);
        return ResponseEntity.ok(incidentService.updateStatus(id, request, adminUserId));
=======
            @Valid @RequestBody UpdateStatusRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, REVIEW_ROLES);
        Long reviewerId = extractUserId(httpRequest);
        return ResponseEntity.ok(incidentService.updateStatus(id, request, reviewerId));
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
<<<<<<< HEAD
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header.trim());
=======
        return header != null ? Long.parseLong(header) : null;
>>>>>>> 2a9ed46bf055becfe9832abb718f3d09b45d87f3
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
