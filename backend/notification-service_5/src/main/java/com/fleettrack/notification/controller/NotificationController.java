package com.fleettrack.notification.controller;

import com.fleettrack.notification.model.dto.NotificationResponse;
import com.fleettrack.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

// The API gateway strips the "/notifications" prefix, so paths here are relative to it:
//   GET  /notifications/users/{userId}          -> /users/{userId}
//   GET  /notifications/users/{userId}/unread   -> /users/{userId}/unread
//   PUT  /notifications/{id}/read               -> /{id}/read
//   PUT  /notifications/users/{userId}/read-all -> /users/{userId}/read-all
@RestController
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/users/{userId}")
    public ResponseEntity<List<NotificationResponse>> list(@PathVariable Long userId) {
        return ResponseEntity.ok(notificationService.listForUser(userId));
    }

    @GetMapping("/users/{userId}/unread")
    public ResponseEntity<Map<String, Long>> unreadCount(@PathVariable Long userId) {
        return ResponseEntity.ok(Map.of("count", notificationService.unreadCount(userId)));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id) {
        notificationService.markRead(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/read-all")
    public ResponseEntity<Void> markAllRead(@PathVariable Long userId) {
        notificationService.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }
}
