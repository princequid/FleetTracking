package com.fleettrack.driver.controller;

import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.service.DriverService;
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
public class DriverController {

    private final DriverService driverService;

    private static final List<String> READ_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
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
        requireRole(request, READ_ROLES);
        return ResponseEntity.ok(driverService.getDriverById(id));
    }

    @GetMapping("/{id}/stats")
    public ResponseEntity<DriverStatsResponse> getDriverStats(@PathVariable Long id, HttpServletRequest request) {
        requireRole(request, READ_ROLES);
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
}
