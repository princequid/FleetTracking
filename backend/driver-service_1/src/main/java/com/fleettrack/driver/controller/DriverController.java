package com.fleettrack.driver.controller;

import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.service.DriverService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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
public class DriverController {

    private final DriverService driverService;

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    private static final List<String> READ_ROLES  = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    // NOTE on the explicit sort (both list endpoints): without it, findAll(pageable) has no
    // ORDER BY and PostgreSQL may return rows in any order, so which 50 you get is not stable
    // between identical requests. See TripController.getTrips for the full reasoning.
    @GetMapping
    public ResponseEntity<List<DriverProfileResponse>> getAllDrivers(
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest request) {
        requireRole(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getAllDrivers(pageable));
    }

    @GetMapping("/available")
    public ResponseEntity<List<DriverProfileResponse>> getActiveDrivers(
            @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable,
            HttpServletRequest request) {
        requireRole(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getActiveDrivers(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DriverProfileResponse> getDriverById(@PathVariable Long id, HttpServletRequest request) {
        requireRoleOrInternal(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getDriverById(id));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<DriverProfileResponse> getDriverByUserId(@PathVariable Long userId, HttpServletRequest request) {
        requireRoleOrInternalOrSelf(request, READ_ROLES, userId);
        return ResponseEntity.ok(driverService.getDriverByUserId(userId));
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<DriverStatsResponse> getDriverStats(@PathVariable Long id, HttpServletRequest request) {
        requireRoleOrInternalOrSelfById(request, READ_ROLES, id);
        return ResponseEntity.ok(driverService.getDriverStats(id));
    }

    @PostMapping
    public ResponseEntity<DriverProfileResponse> createDriver(
            @Valid @RequestBody DriverProfileRequest body, HttpServletRequest request) {
        requireRole(request, WRITE_ROLES);
        return ResponseEntity.status(HttpStatus.CREATED).body(driverService.createDriver(body));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DriverProfileResponse> updateDriver(
            @PathVariable Long id, @Valid @RequestBody DriverProfileRequest body, HttpServletRequest request) {
        requireRole(request, WRITE_ROLES);
        return ResponseEntity.ok(driverService.updateDriver(id, body));
    }

    @PutMapping("/{id}/deactivate")
    public ResponseEntity<DriverProfileResponse> deactivateDriver(@PathVariable Long id, HttpServletRequest request) {
        requireRole(request, List.of("SUPER_ADMIN"));
        return ResponseEntity.ok(driverService.deactivateDriver(id));
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    private void requireRoleOrInternal(HttpServletRequest request, List<String> allowedRoles) {
        if (isGenuinelyInternal(request)) {
            return;
        }
        requireRole(request, allowedRoles);
    }

    /**
     * The gateway stamps X-Internal-Service-Key on EVERY proxied request — including a
     * normal end user's own request — so the key alone can't distinguish a genuine bare
     * service-to-service call (which never carries X-User-Role) from a gateway-proxied
     * end-user request (which always does, per JwtAuthFilter). Require both, or the
     * "OrInternal"/self checks below are silently bypassed by any authenticated caller.
     */
    private boolean isGenuinelyInternal(HttpServletRequest request) {
        String internalKey = request.getHeader("X-Internal-Service-Key");
        String role = request.getHeader("X-User-Role");
        return internalServiceSecret.equals(internalKey) && (role == null || role.isBlank());
    }

    /** Allows admin roles, internal callers, OR a DRIVER fetching their own userId. */
    private void requireRoleOrInternalOrSelf(HttpServletRequest request, List<String> allowedRoles, Long pathUserId) {
        if (isGenuinelyInternal(request)) {
            return;
        }
        String role = request.getHeader("X-User-Role");
        if (allowedRoles.contains(role)) {
            return;
        }
        if ("DRIVER".equals(role)) {
            String headerUserId = request.getHeader("X-User-Id");
            if (String.valueOf(pathUserId).equals(headerUserId)) {
                return;
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    /**
     * Allows admin roles, internal callers, OR a DRIVER fetching their own stats.
     * Unlike {@link #requireRoleOrInternalOrSelf}, the path variable here is the driver's
     * internal profile id (not the auth userId), so a DRIVER caller's identity has to be
     * resolved by loading the profile and comparing its userId against X-User-Id.
     */
    private void requireRoleOrInternalOrSelfById(HttpServletRequest request, List<String> allowedRoles, Long pathId) {
        if (isGenuinelyInternal(request)) {
            return;
        }
        String role = request.getHeader("X-User-Role");
        if (allowedRoles.contains(role)) {
            return;
        }
        if ("DRIVER".equals(role)) {
            String headerUserId = request.getHeader("X-User-Id");
            if (headerUserId != null) {
                DriverProfileResponse driver = driverService.getDriverById(pathId);
                if (String.valueOf(driver.getUserId()).equals(headerUserId)) {
                    return;
                }
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }
}
