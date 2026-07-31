package com.fleettrack.notification.controller;

import com.fleettrack.notification.model.dto.DeviceTokenRequest;
import com.fleettrack.notification.service.DeviceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

// Gateway strips the "/notifications" prefix, so:
//   POST   /notifications/devices          -> /devices
//   DELETE /notifications/devices/{token}  -> /devices/{token}
// The gateway also authenticates the caller, so only signed-in users reach here.
@RestController
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    // Bound to the authenticated caller's own id (X-User-Id, injected by the gateway) —
    // never to a client-supplied id — so a caller can't register a device token for,
    // and hijack push delivery to, another user.
    @PostMapping("/devices")
    public ResponseEntity<Void> register(@RequestBody DeviceTokenRequest req, HttpServletRequest request) {
        Long callerId = extractUserId(request);
        deviceService.register(callerId, req.getToken(), req.getPlatform());
        return ResponseEntity.noContent().build();
    }

    // Scoped to the caller's own tokens. Previously this took only the token from
    // the path with no ownership check, so any authenticated user who obtained
    // another user's device token could silently disable their push delivery —
    // which in this system includes critical incident alerts to drivers.
    @DeleteMapping("/devices/{token}")
    public ResponseEntity<Void> unregister(@PathVariable String token, HttpServletRequest request) {
        Long callerId = extractUserId(request);
        deviceService.unregisterForUser(callerId, token);
        return ResponseEntity.noContent().build();
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header.trim());
    }
}
