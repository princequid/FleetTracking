package com.fleettrack.gps.controller;

import com.fleettrack.gps.client.DriverServiceClient;
import com.fleettrack.gps.client.TripServiceClient;
import com.fleettrack.gps.model.dto.DriverIdResponse;
import com.fleettrack.gps.model.dto.GpsPingRequest;
import com.fleettrack.gps.model.dto.GpsPingResponse;
import com.fleettrack.gps.model.dto.TripOwnerResponse;
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
    private final DriverServiceClient driverServiceClient;
    private final TripServiceClient tripServiceClient;

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
        verifyDriverOwnsTrip(httpRequest, tripId);
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(gpsService.savePing(tripId, request, driverId));
    }

    @GetMapping("/trips/{tripId}/route")
    public ResponseEntity<List<GpsPingResponse>> getRoute(
            @PathVariable Long tripId,
            @RequestParam(required = false) Integer limit,
            HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        verifyDriverOwnsTrip(httpRequest, tripId);
        return ResponseEntity.ok(gpsService.getRoute(tripId, limit));
    }

    @GetMapping("/trips/{tripId}/latest")
    public ResponseEntity<GpsPingResponse> getLatestPing(@PathVariable Long tripId, HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        verifyDriverOwnsTrip(httpRequest, tripId);
        return ResponseEntity.ok(gpsService.getLatestPing(tripId));
    }

    @PostMapping("/trips/{tripId}/pings/bulk")
    public ResponseEntity<List<GpsPingResponse>> saveBulkPings(
            @PathVariable Long tripId,
            @Valid @RequestBody List<GpsPingRequest> requests,
            HttpServletRequest httpRequest) {
        requireKnownRole(httpRequest);
        verifyDriverOwnsTrip(httpRequest, tripId);
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

    private void requireKnownRole(HttpServletRequest request) {
        requireRole(request, ALL_KNOWN_ROLES);
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    // Confirms a DRIVER caller is actually assigned to the tripId in the path — a no-op
    // for ADMIN/DISPATCHER/SUPER_ADMIN callers, who are allowed to see/post for any trip.
    // X-User-Id is the auth-service user id, but trips are keyed by driver-profile id
    // (from driver-service), so this resolves one to the other before comparing —
    // same pattern as trip-service's/media-service's own ownership checks.
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
