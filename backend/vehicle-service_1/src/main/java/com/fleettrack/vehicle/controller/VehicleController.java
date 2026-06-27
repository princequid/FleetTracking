package com.fleettrack.vehicle.controller;

import com.fleettrack.vehicle.model.dto.VehicleRequest;
import com.fleettrack.vehicle.model.dto.VehicleResponse;
import com.fleettrack.vehicle.service.VehicleService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor
public class VehicleController {
    private final VehicleService vehicleService;
    private static final List<String> READ_ROLES = List.of("ADMIN", "DISPATCHER", "SUPER_ADMIN");
    private static final List<String> WRITE_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @PostMapping
    public ResponseEntity<VehicleResponse> create(@Valid @RequestBody VehicleRequest req, HttpServletRequest r) {
        requireRole(r, WRITE_ROLES); return ResponseEntity.status(HttpStatus.CREATED).body(vehicleService.createVehicle(req)); }
    @GetMapping
    public ResponseEntity<List<VehicleResponse>> getAll(HttpServletRequest r) { requireRole(r, READ_ROLES); return ResponseEntity.ok(vehicleService.getAllVehicles()); }
    @GetMapping("/available")
    public ResponseEntity<List<VehicleResponse>> getAvailable(HttpServletRequest r) { requireRole(r, READ_ROLES); return ResponseEntity.ok(vehicleService.getAvailable()); }
    @GetMapping("/{id}")
    public ResponseEntity<VehicleResponse> getById(@PathVariable Long id, HttpServletRequest r) { requireRole(r, READ_ROLES); return ResponseEntity.ok(vehicleService.getById(id)); }
    @PutMapping("/{id}")
    public ResponseEntity<VehicleResponse> update(@PathVariable Long id, @Valid @RequestBody VehicleRequest req, HttpServletRequest r) {
        requireRole(r, WRITE_ROLES); return ResponseEntity.ok(vehicleService.update(id, req)); }
    @PutMapping("/{id}/status")
    public ResponseEntity<VehicleResponse> updateStatus(@PathVariable Long id, @RequestBody Map<String, String> body, HttpServletRequest r) {
        requireRole(r, WRITE_ROLES); return ResponseEntity.ok(vehicleService.updateStatus(id, body)); }

    private void requireRole(HttpServletRequest r, List<String> roles) {
        String role = r.getHeader("X-User-Role");
        if (role == null || !roles.contains(role)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
    }
}
