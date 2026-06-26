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
<<<<<<< gps-service
@RequestMapping("/gps")
=======
>>>>>>> main
@RequiredArgsConstructor
public class GpsController {

    private final GpsService gpsService;

    @PostMapping("/trips/{tripId}/ping")
    public ResponseEntity<GpsPingResponse> savePing(
            @PathVariable Long tripId,
            @Valid @RequestBody GpsPingRequest request,
            HttpServletRequest httpRequest) {
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(gpsService.savePing(tripId, request, driverId));
    }

    @GetMapping("/trips/{tripId}/route")
    public ResponseEntity<List<GpsPingResponse>> getRoute(@PathVariable Long tripId) {
        return ResponseEntity.ok(gpsService.getRoute(tripId));
    }

    @GetMapping("/trips/{tripId}/latest")
    public ResponseEntity<GpsPingResponse> getLatestPing(@PathVariable Long tripId) {
        return ResponseEntity.ok(gpsService.getLatestPing(tripId));
    }

    @PostMapping("/trips/{tripId}/pings/bulk")
    public ResponseEntity<List<GpsPingResponse>> saveBulkPings(
            @PathVariable Long tripId,
            @Valid @RequestBody List<GpsPingRequest> requests,
            HttpServletRequest httpRequest) {
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(gpsService.saveBulkPings(tripId, requests, driverId));
    }

    @GetMapping("/trips/active")
    public ResponseEntity<List<GpsPingResponse>> getActivePositions() {
        return ResponseEntity.ok(gpsService.getActivePositions());
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header);
    }
}
