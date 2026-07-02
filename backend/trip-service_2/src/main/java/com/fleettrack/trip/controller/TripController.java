package com.fleettrack.trip.controller;

import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.model.dto.CreateTripRequest;
import com.fleettrack.trip.model.dto.DriverResponse;
import com.fleettrack.trip.model.dto.TripResponse;
import com.fleettrack.trip.model.dto.TripStatusHistoryResponse;
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
    private final DriverServiceClient driverServiceClient;

    private static final List<String> ALL_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> TRANSITION_ROLES = List.of("DRIVER", "ADMIN", "SUPER_ADMIN");
    private static final List<String> CANCEL_ROLES = List.of("ADMIN", "SUPER_ADMIN");

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
            // userId is the auth-service ID; trips are keyed by driver-profile ID
            DriverResponse driverProfile = driverServiceClient.getDriverByUserId(Long.parseLong(userId));
            if (driverProfile == null) {
                return ResponseEntity.ok(List.of());
            }
            return ResponseEntity.ok(tripService.getTripsByDriver(driverProfile.getId(), status));
        }
        return ResponseEntity.ok(tripService.getAllTrips(status));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getTripById(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);
        return ResponseEntity.ok(tripService.getTripById(id));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<TripStatusHistoryResponse>> getTripHistory(
            @PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);
        return ResponseEntity.ok(tripService.getTripStatusHistory(id));
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<TripResponse> startTrip(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(tripService.startTrip(id, userId));
    }

    @PutMapping("/{id}/arrive")
    public ResponseEntity<TripResponse> markArrived(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(tripService.markArrived(id, userId));
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<TripResponse> completeTrip(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(tripService.completeTrip(id, userId));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<TripResponse> cancelTrip(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, CANCEL_ROLES);
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(tripService.cancelTrip(id, userId));
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
