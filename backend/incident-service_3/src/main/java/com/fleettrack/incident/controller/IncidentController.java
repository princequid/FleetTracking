package com.fleettrack.incident.controller;

import com.fleettrack.incident.client.DriverServiceClient;
import com.fleettrack.incident.client.TripServiceClient;
import com.fleettrack.incident.model.dto.CreateIncidentRequest;
import com.fleettrack.incident.model.dto.DriverIdResponse;
import com.fleettrack.incident.model.dto.IncidentResponse;
import com.fleettrack.incident.model.dto.TripOwnerResponse;
import com.fleettrack.incident.model.dto.UpdateIncidentStatusRequest;
import com.fleettrack.incident.model.enums.IncidentStatus;
import com.fleettrack.incident.service.IncidentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class IncidentController {

    private final IncidentService incidentService;
    private final DriverServiceClient driverServiceClient;
    private final TripServiceClient tripServiceClient;

    private static final List<String> CREATE_ROLES = List.of("DRIVER", "ADMIN", "SUPER_ADMIN");
    private static final List<String> LIST_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> STATUS_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<IncidentResponse> createIncident(
            @Valid @RequestBody CreateIncidentRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, CREATE_ROLES);
        Long driverId = extractUserId(httpRequest);
        verifyDriverOwnsTrip(httpRequest, request.getTripId());
        return ResponseEntity.status(HttpStatus.CREATED).body(incidentService.reportIncident(request, driverId));
    }

    @GetMapping
    public ResponseEntity<List<IncidentResponse>> getIncidents(
            @RequestParam(required = false) IncidentStatus status,
            // Explicit sort required for stable paging — see TripController.getTrips.
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, LIST_ROLES);
        return ResponseEntity.ok(incidentService.getAllIncidents(status, pageable));
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

    // Confirms a DRIVER caller is actually assigned to the tripId they're reporting an
    // incident against — a no-op for ADMIN/SUPER_ADMIN callers (CREATE_ROLES), who may
    // report against any trip. Same pattern as gps-service's/trip-service's own checks.
    private void verifyDriverOwnsTrip(HttpServletRequest request, Long tripId) {
        String role = request.getHeader("X-User-Role");
        if (!"DRIVER".equals(role)) return;

        Long userId = extractUserId(request);
        DriverIdResponse driverProfile = driverServiceClient.getDriverByUserId(userId);
        if (driverProfile == null || driverProfile.getId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        TripOwnerResponse trip = tripServiceClient.getTrip(tripId);
        if (trip == null || trip.getDriverId() == null || !trip.getDriverId().equals(driverProfile.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to this trip");
        }
    }
}
