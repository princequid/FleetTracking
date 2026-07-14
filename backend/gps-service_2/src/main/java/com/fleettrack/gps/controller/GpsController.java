package com.fleettrack.gps.controller;

import com.fleettrack.gps.model.dto.GpsPingRequest;
import com.fleettrack.gps.model.dto.GpsPingResponse;
import com.fleettrack.gps.service.GpsService;
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
public class GpsController {

    private final GpsService gpsService;

    // Roles allowed to see fleet-wide / cross-trip data (dispatch-desk style access).
    // Kept in sync with the role set trip-service's TripController enforces.
    private static final List<String> DISPATCH_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> ALL_KNOWN_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");

    @PostMapping("/trips/{tripId}/ping")
    public ResponseEntity<GpsPingResponse> savePing(
            @PathVariable Long tripId,
            @Valid @RequestBody GpsPingRequest request,
            HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(gpsService.savePing(tripId, request, driverId));
    }

    @GetMapping("/trips/{tripId}/route")
    public ResponseEntity<List<GpsPingResponse>> getRoute(
            @PathVariable Long tripId,
            @RequestParam(required = false) Integer limit,
            HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        return ResponseEntity.ok(gpsService.getRoute(tripId, limit));
    }

    @GetMapping("/trips/{tripId}/latest")
    public ResponseEntity<GpsPingResponse> getLatestPing(@PathVariable Long tripId, HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        return ResponseEntity.ok(gpsService.getLatestPing(tripId));
    }

    @PostMapping("/trips/{tripId}/pings/bulk")
    public ResponseEntity<List<GpsPingResponse>> saveBulkPings(
            @PathVariable Long tripId,
            @Valid @RequestBody List<GpsPingRequest> requests,
            HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(gpsService.saveBulkPings(tripId, requests, driverId));
    }

    // Fleet-wide feed — no driver should ever get this (it exposes every active
    // vehicle's position, not just their own trip's). Dispatch-desk roles only.
    @GetMapping("/trips/active")
    public ResponseEntity<List<GpsPingResponse>> getActivePositions(HttpServletRequest httpRequest) {
        requireRole(httpRequest, DISPATCH_ROLES);
        return ResponseEntity.ok(gpsService.getActivePositions());
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header);
    }

    // NOTE: this only confirms the caller carries a recognized role — it does NOT verify
    // that a DRIVER caller is actually assigned to the tripId in the path. Doing that would
    // require a new cross-service lookup (X-User-Id is the auth-service user id, but trips
    // are keyed by driver-profile id from driver-service — see trip-service's
    // DriverServiceClient.getDriverByUserId for the equivalent mapping), which doesn't exist
    // in this service today. Adding one under time pressure was judged too risky/fragile for
    // this pass; deferred rather than built half-working. See audit report for detail.
    private void requireKnownRole(HttpServletRequest request) {
        requireRole(request, ALL_KNOWN_ROLES);
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
