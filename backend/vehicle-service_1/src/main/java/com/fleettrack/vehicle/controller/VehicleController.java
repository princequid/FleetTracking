package com.fleettrack.vehicle.controller;

import com.fleettrack.vehicle.model.dto.VehicleRequest;
import com.fleettrack.vehicle.model.dto.VehicleResponse;
import com.fleettrack.vehicle.model.enums.VehicleStatus;
import com.fleettrack.vehicle.service.VehicleService;
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
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class VehicleController {
    private final VehicleService vehicleService;

    @Value("${internal.service.secret:}")
    private String internalServiceSecret;

    private static final List<String> LIST_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> AVAILABLE_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<VehicleResponse> createVehicle(
            @Valid @RequestBody VehicleRequest req, HttpServletRequest r) {
        requireRole(r, WRITE_ROLES);
        return ResponseEntity.status(HttpStatus.CREATED).body(vehicleService.createVehicle(req));
    }

    @GetMapping
    public ResponseEntity<List<VehicleResponse>> getAllVehicles(
            @PageableDefault(size = 50) Pageable pageable, HttpServletRequest r) {
        requireRole(r, LIST_ROLES);
        return ResponseEntity.ok(vehicleService.getAllVehicles(pageable));
    }

    @GetMapping("/available")
    public ResponseEntity<List<VehicleResponse>> getAvailableVehicles(
            @PageableDefault(size = 50) Pageable pageable, HttpServletRequest r) {
        requireRole(r, AVAILABLE_ROLES);
        return ResponseEntity.ok(vehicleService.getAvailableVehicles(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<VehicleResponse> getVehicleById(@PathVariable Long id, HttpServletRequest r) {
        requireRoleOrInternal(r, LIST_ROLES);
        return ResponseEntity.ok(vehicleService.getVehicleById(id));
    }

    @PutMapping("/{id}")
    public ResponseEntity<VehicleResponse> updateVehicle(
            @PathVariable Long id, @Valid @RequestBody VehicleRequest req, HttpServletRequest r) {
        requireRole(r, WRITE_ROLES);
        return ResponseEntity.ok(vehicleService.updateVehicle(id, req));
    }

    @PutMapping("/{id}/status")
    public ResponseEntity<VehicleResponse> updateStatus(
            @PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest r) {
        requireRoleOrInternal(r, WRITE_ROLES);
        String rawStatus = body.get("status");
        if (rawStatus == null || rawStatus.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status is required");
        }
        VehicleStatus status;
        try {
            status = VehicleStatus.valueOf(rawStatus.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status value: " + rawStatus);
        }
        return ResponseEntity.ok(vehicleService.updateStatus(id, status));
    }

    private void requireRole(HttpServletRequest r, List<String> roles) {
        String role = r.getHeader("X-User-Role");
        if (role == null || !roles.contains(role))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }

    private void requireRoleOrInternal(HttpServletRequest r, List<String> roles) {
        if (isGenuinelyInternal(r)) {
            return;
        }
        requireRole(r, roles);
    }

    /**
     * The gateway stamps X-Internal-Service-Key on EVERY proxied request — including a
     * normal end user's own request — so the key alone can't distinguish a genuine bare
     * service-to-service call (which never carries X-User-Role) from a gateway-proxied
     * end-user request (which always does, per JwtAuthFilter). Require both.
     */
    private boolean isGenuinelyInternal(HttpServletRequest r) {
        String internalKey = r.getHeader("X-Internal-Service-Key");
        String role = r.getHeader("X-User-Role");
        return internalServiceSecret.equals(internalKey) && (role == null || role.isBlank());
    }
}
