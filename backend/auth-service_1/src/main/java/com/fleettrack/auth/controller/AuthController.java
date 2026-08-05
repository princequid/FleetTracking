package com.fleettrack.auth.controller;

import com.fleettrack.auth.model.dto.*;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.service.AuthService;
import com.fleettrack.auth.service.PasswordResetService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, Object>> register(@Valid @RequestBody RegisterRequest request) {
        User user = authService.registerUser(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "userId", user.getId(),
                "email", user.getEmail(),
                "role", user.getRole()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request);
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/validate")
    public ResponseEntity<ValidateResponse> validate(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {
        return ResponseEntity.ok(authService.validate(authHeader));
    }

    // Always 200 regardless of outcome — the response must never reveal whether an
    // email is registered, and a failed/slow email send shouldn't surface as an error.
    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        passwordResetService.requestReset(request.getEmail());
        return ResponseEntity.ok(Map.of("message", "If that email is registered, a reset link has been sent."));
    }

    // `role` is returned so the client knows where to send the user next. Both the
    // web page and the app screen post here, and the reset link's token is opaque —
    // neither can tell a driver from a portal user on its own, and sending a driver
    // to the admin portal's sign-in screen strands them at a login they cannot use.
    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        Role role = passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of(
                "message", "Password updated successfully.",
                "role", role.name()
        ));
    }

    // NOT in the gateway's PUBLIC_PATHS — the caller must already have a valid JWT,
    // which the gateway validates and turns into the X-User-Id header read below.
    @PutMapping("/first-login-ack")
    public ResponseEntity<Map<String, String>> firstLoginAck(
            @RequestBody FirstLoginAckRequest request, HttpServletRequest httpRequest) {
        authService.firstLoginAck(extractUserId(httpRequest), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Acknowledged."));
    }

    private Long extractUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing X-User-Id header");
        }
        return Long.parseLong(header.trim());
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, String>> handleResponseStatus(ResponseStatusException ex) {
        return ResponseEntity.status(ex.getStatusCode()).body(Map.of("error", ex.getReason()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
    }
}
