package com.fleettrack.driver.controller;

import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.service.DriverService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
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
    private static final List<String> STATS_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN", "DRIVER");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @GetMapping
    public ResponseEntity<List<DriverProfileResponse>> getAllDrivers(HttpServletRequest request) {
        requireRole(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getAllDrivers());
    }

    @GetMapping("/available")
    public ResponseEntity<List<DriverProfileResponse>> getActiveDrivers(HttpServletRequest request) {
        requireRole(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getActiveDrivers());
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
        requireRoleOrInternal(request, STATS_ROLES);
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
        String internalKey = request.getHeader("X-Internal-Service-Key");
        if (internalServiceSecret.equals(internalKey)) {
            return;
        }
        requireRole(request, allowedRoles);
    }

    /** Allows admin roles, internal callers, OR a DRIVER fetching their own userId. */
    private void requireRoleOrInternalOrSelf(HttpServletRequest request, List<String> allowedRoles, Long pathUserId) {
        String internalKey = request.getHeader("X-Internal-Service-Key");
        if (internalServiceSecret.equals(internalKey)) {
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
}
