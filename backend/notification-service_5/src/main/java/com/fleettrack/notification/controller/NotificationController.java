package com.fleettrack.notification.controller;

import com.fleettrack.notification.model.dto.NotificationResponse;
import com.fleettrack.notification.service.NotificationService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

// The API gateway strips the "/notifications" prefix, so paths here are relative to it:
//   GET  /notifications/users/{userId}          -> /users/{userId}
//   GET  /notifications/users/{userId}/unread   -> /users/{userId}/unread
//   PUT  /notifications/{id}/read               -> /{id}/read
//   PUT  /notifications/users/{userId}/read-all -> /users/{userId}/read-all
//
// The gateway authenticates every caller and stamps X-User-Id/X-User-Role on the
// proxied request, so authorization here is derived from those headers rather than
// trusting the path variables — otherwise any signed-in user could read or mark-read
// another user's notifications just by changing the id in the URL.
@RestController
@RequiredArgsConstructor
public class NotificationController {

    private static final List<String> ADMIN_ROLES = List.of("ADMIN", "SUPER_ADMIN", "DISPATCHER");

    private final NotificationService notificationService;

    @GetMapping("/users/{userId}")
    public ResponseEntity<List<NotificationResponse>> list(@PathVariable Long userId, HttpServletRequest request) {
        authorizeUserAccess(request, userId);
        return ResponseEntity.ok(notificationService.listForUser(userId));
    }

    @GetMapping("/users/{userId}/unread")
    public ResponseEntity<Map<String, Long>> unreadCount(@PathVariable Long userId, HttpServletRequest request) {
        authorizeUserAccess(request, userId);
        return ResponseEntity.ok(Map.of("count", notificationService.unreadCount(userId)));
    }

    @PutMapping("/{id}/read")
    public ResponseEntity<Void> markRead(@PathVariable Long id, HttpServletRequest request) {
        Long callerId = extractUserId(request);
        String role = request.getHeader("X-User-Role");
        if (!ADMIN_ROLES.contains(role) && !notificationService.belongsToRecipient(id, callerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        notificationService.markRead(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/users/{userId}/read-all")
    public ResponseEntity<Void> markAllRead(@PathVariable Long userId, HttpServletRequest request) {
        authorizeUserAccess(request, userId);
        notificationService.markAllRead(userId);
        return ResponseEntity.noContent().build();
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        return Long.parseLong(header.trim());
    }

    // Allows the caller to act on their own notifications, or an admin-type role
    // (dispatcher/support) to act on any user's notifications.
    private void authorizeUserAccess(HttpServletRequest request, Long pathUserId) {
        Long callerId = extractUserId(request);
        String role = request.getHeader("X-User-Role");
        if (ADMIN_ROLES.contains(role)) {
            return;
        }
        if (!pathUserId.equals(callerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }
}
