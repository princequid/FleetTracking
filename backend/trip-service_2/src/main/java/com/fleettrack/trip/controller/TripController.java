package com.fleettrack.trip.controller;

import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.model.dto.CreateTripRequest;
import com.fleettrack.trip.model.dto.DriverResponse;
import com.fleettrack.trip.model.dto.LocationRequest;
import com.fleettrack.trip.model.dto.TripResponse;
import com.fleettrack.trip.model.dto.TripStatusHistoryResponse;
import com.fleettrack.trip.service.TripService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
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

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

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
            @PageableDefault(size = 50) Pageable pageable,
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
            return ResponseEntity.ok(tripService.getTripsByDriver(driverProfile.getId(), status, pageable));
        }
        return ResponseEntity.ok(tripService.getAllTrips(status, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TripResponse> getTripById(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRoleOrInternal(httpRequest, ALL_ROLES);
        Long requesterDriverId = resolveOwnDriverId(httpRequest);
        return ResponseEntity.ok(tripService.getTripById(id, requesterDriverId));
    }

    @GetMapping("/{id}/history")
    public ResponseEntity<List<TripStatusHistoryResponse>> getTripHistory(
            @PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, ALL_ROLES);
        Long requesterDriverId = resolveOwnDriverId(httpRequest);
        return ResponseEntity.ok(tripService.getTripStatusHistory(id, requesterDriverId));
    }

    @PutMapping("/{id}/start")
    public ResponseEntity<TripResponse> startTrip(
            @PathVariable Long id,
            @RequestBody(required = false) LocationRequest location,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        Long requesterDriverId = resolveOwnDriverId(httpRequest);
        return ResponseEntity.ok(tripService.startTrip(id, userId, location, requesterDriverId));
    }

    @PutMapping("/{id}/arrive")
    public ResponseEntity<TripResponse> markArrived(
            @PathVariable Long id,
            @RequestBody(required = false) LocationRequest location,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        Long requesterDriverId = resolveOwnDriverId(httpRequest);
        return ResponseEntity.ok(tripService.markArrived(id, userId, location, requesterDriverId));
    }

    @PutMapping("/{id}/complete")
    public ResponseEntity<TripResponse> completeTrip(@PathVariable Long id, HttpServletRequest httpRequest) {
        requireRole(httpRequest, TRANSITION_ROLES);
        Long userId = extractUserId(httpRequest);
        Long requesterDriverId = resolveOwnDriverId(httpRequest);
        return ResponseEntity.ok(tripService.completeTrip(id, userId, requesterDriverId));
    }

    @PutMapping("/{id}/cancel")
    public ResponseEntity<TripResponse> cancelTrip(@PathVariable Long id, HttpServletRequest httpRequest) {
        // CANCEL_ROLES is admin-only (no DRIVER) — ownership check is intentionally not
        // applied here since drivers can never reach this endpoint in the first place.
        requireRole(httpRequest, CANCEL_ROLES);
        Long userId = extractUserId(httpRequest);
        return ResponseEntity.ok(tripService.cancelTrip(id, userId));
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        return header != null ? Long.parseLong(header) : null;
    }

    // Resolves the caller's driver-profile id for ownership enforcement. Returns null for
    // any non-DRIVER caller (admin/dispatcher) or internal-service call — null means "no
    // ownership restriction" downstream in TripService. Throws FORBIDDEN if the caller
    // claims to be a DRIVER but their driver profile can't be resolved, since ownership
    // can't be verified in that case.
    private Long resolveOwnDriverId(HttpServletRequest request) {
        String role = request.getHeader("X-User-Role");
        if (!"DRIVER".equals(role)) {
            return null;
        }
        String userId = request.getHeader("X-User-Id");
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        DriverResponse driverProfile = driverServiceClient.getDriverByUserId(Long.parseLong(userId));
        if (driverProfile == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return driverProfile.getId();
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    // Allows trusted internal-service callers (e.g. media-service verifying trip/photo
    // ownership) to bypass the X-User-Role check via the shared internal-service secret,
    // mirroring the pattern already used in driver-service's DriverController.
    //
    // NOTE: the gateway stamps X-Internal-Service-Key on EVERY proxied request, including
    // a normal end user's own request, so the key alone can't distinguish a genuine bare
    // service-to-service call (no X-User-Role) from a gateway-proxied end-user request
    // (always has X-User-Role, per JwtAuthFilter) — require both. For this specific
    // endpoint the practical impact is nil today since ALL_ROLES already covers every
    // real role, but this helper shouldn't silently no-op if reused with a narrower list.
    private void requireRoleOrInternal(HttpServletRequest request, List<String> allowedRoles) {
        String internalKey = request.getHeader("X-Internal-Service-Key");
        String role = request.getHeader("X-User-Role");
        boolean genuinelyInternal = internalServiceSecret.equals(internalKey) && (role == null || role.isBlank());
        if (genuinelyInternal) {
            return;
        }
        requireRole(request, allowedRoles);
    }
}
