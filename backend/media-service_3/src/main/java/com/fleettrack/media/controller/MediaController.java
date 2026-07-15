package com.fleettrack.media.controller;

import com.fleettrack.media.model.dto.PhotoRegistrationRequest;
import com.fleettrack.media.model.dto.PhotoResponse;
import com.fleettrack.media.model.dto.PresignRequest;
import com.fleettrack.media.model.dto.PresignResponse;
import com.fleettrack.media.model.entity.Photo;
import com.fleettrack.media.service.MediaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class MediaController {

    private final MediaService mediaService;

    @Value("${internal.service.secret}")
    private String internalServiceSecret;

    private static final List<String> DRIVER_ROLES = List.of("DRIVER");
    private static final List<String> ADMIN_DISPATCHER_ROLES = List.of("ADMIN", "DISPATCHER");

    @PostMapping("/presign")
    public ResponseEntity<PresignResponse> generatePresignedUrl(
            @Valid @RequestBody PresignRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, DRIVER_ROLES);
        Long driverId = extractUserId(httpRequest);
        return ResponseEntity.ok(mediaService.generatePresignedUrl(request, driverId));
    }

    @PostMapping("/photos")
    public ResponseEntity<PhotoResponse> registerPhoto(
            @Valid @RequestBody PhotoRegistrationRequest request,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, DRIVER_ROLES);
        Long driverId = extractUserId(httpRequest);
        Photo photo = mediaService.registerPhoto(request, driverId);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(photo));
    }

    @GetMapping("/photos/trips/{id}/status")
    public ResponseEntity<Map<String, Object>> getTripPhotoStatus(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        requireRoleOrInternal(httpRequest, ADMIN_DISPATCHER_ROLES);
        boolean hasPOD = mediaService.hasPOD(id);
        // Include the POD photo's own geotag (if any) so trip-service can verify it was
        // actually captured near the destination before allowing trip completion.
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("hasPOD", hasPOD);
        mediaService.getPodPhoto(id).ifPresent(photo -> {
            body.put("lat", photo.getLat());
            body.put("lng", photo.getLng());
        });
        return ResponseEntity.ok(body);
    }

    @GetMapping("/photos/trips/{id}")
    public ResponseEntity<List<PhotoResponse>> getTripPhotos(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        requireRole(httpRequest, ADMIN_DISPATCHER_ROLES);
        List<Photo> photos = mediaService.getPhotosByTrip(id);
        return ResponseEntity.ok(photos.stream().map(this::toResponse).toList());
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header required");
        }
        try {
            return Long.parseLong(header.trim());
        } catch (NumberFormatException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header must be numeric");
        }
    }

    private void requireRole(HttpServletRequest request, List<String> allowedRoles) {
        String role = request.getHeader("X-User-Role");
        if (role == null || !allowedRoles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
    }

    // Allows trusted internal service-to-service calls (e.g. trip-service checking
    // POD status before completing a trip) which carry no X-User-Role, in addition
    // to normal gateway-proxied requests from an allowed role.
    //
    // NOTE: the gateway stamps X-Internal-Service-Key on EVERY proxied request,
    // including a normal end user's own request, so the key alone can't distinguish
    // a genuine bare service-to-service call from a gateway-proxied end-user request
    // (which always also carries X-User-Role, per JwtAuthFilter). Both conditions are
    // required, or this check is silently bypassed by any authenticated caller.
    private void requireRoleOrInternal(HttpServletRequest request, List<String> allowedRoles) {
        String internalKey = request.getHeader("X-Internal-Service-Key");
        String role = request.getHeader("X-User-Role");
        boolean genuinelyInternal = internalServiceSecret.equals(internalKey) && (role == null || role.isBlank());
        if (genuinelyInternal) {
            return;
        }
        requireRole(request, allowedRoles);
    }

    private PhotoResponse toResponse(Photo photo) {
        // Generate a fresh, correctly-hosted view link on every request rather than
        // trusting the URL stored at upload time — falls back to the stored value only
        // if MinIO is unreachable, so a transient hiccup doesn't blank out the photo list.
        String viewUrl = mediaService.getPhotoViewUrl(photo.getPhotoKey());
        return PhotoResponse.builder()
                .id(photo.getId())
                .tripId(photo.getTripId())
                .stopId(photo.getStopId())
                .photoUrl(viewUrl != null ? viewUrl : photo.getPhotoUrl())
                .photoType(photo.getPhotoType())
                .sha256Hash(photo.getSha256Hash())
                .uploadedAt(photo.getUploadedAt())
                .build();
    }
}
