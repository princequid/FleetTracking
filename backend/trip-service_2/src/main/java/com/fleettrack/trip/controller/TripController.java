package com.fleettrack.trip.controller;

import com.fleettrack.trip.model.dto.CreateTripRequest;
import com.fleettrack.trip.model.dto.TripResponse;
import com.fleettrack.trip.service.TripService;
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
public class TripController {

    private final TripService tripService;

    private static final List<String> ALL_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<TripResponse> createTrip(
            @Valid @RequestBody CreateTripRequest request, HttpServletRequest httpRequest) {
        requireRole(httpRequest, WRITE_ROLES);
        return ResponseEntity.status(HttpStatus.CREATED).body(tripService.createTrip(request));
    }

    @GetMapping
    public ResponseEntity<List<TripResponse>> getTrips(
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);

        String role = httpRequest.getHeader("X-User-Role");
        String userId = httpRequest.getHeader("X-User-Id");

        if ("DRIVER".equals(role) && userId != null) {
            return ResponseEntity.ok(tripService.getTripsByDriver(Long.parseLong(userId), status));
        }
        return ResponseEntity.ok(tripService.getAllTrips(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getTripById(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);
        return ResponseEntity.ok(tripService.getTripById(id));
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
