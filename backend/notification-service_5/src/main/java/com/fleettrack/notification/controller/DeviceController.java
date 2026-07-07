package com.fleettrack.notification.controller;

import com.fleettrack.notification.model.dto.DeviceTokenRequest;
import com.fleettrack.notification.service.DeviceService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// Gateway strips the "/notifications" prefix, so:
//   POST   /notifications/devices          -> /devices
//   DELETE /notifications/devices/{token}  -> /devices/{token}
// The gateway also authenticates the caller, so only signed-in users reach here.
@RestController
@RequiredArgsConstructor
public class DeviceController {

    private final DeviceService deviceService;

    @PostMapping("/devices")
    public ResponseEntity<Void> register(@RequestBody DeviceTokenRequest req) {
        deviceService.register(req.getRecipientId(), req.getToken(), req.getPlatform());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/devices/{token}")
    public ResponseEntity<Void> unregister(@PathVariable String token) {
        deviceService.unregister(token);
        return ResponseEntity.noContent().build();
    }
}
