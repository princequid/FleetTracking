package com.fleettrack.auth.service;

import com.fleettrack.auth.event.AuthEventPublisher;
import com.fleettrack.auth.exception.AccountLockedException;
import com.fleettrack.auth.model.dto.*;
import com.fleettrack.auth.model.entity.RefreshToken;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.RefreshTokenRepository;
import com.fleettrack.auth.repository.UserRepository;
import com.fleettrack.events.BaseEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthEventPublisher authEventPublisher;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;

    // Fixed placeholder hash used to equalize timing when an email lookup fails,
    // so a BCrypt comparison always happens regardless of whether the user exists.
    // Lazily computed (via the real PasswordEncoder) so its cost factor always
    // matches whatever the encoder is actually configured with.
    private volatile String dummyPasswordHash;

    private String getDummyPasswordHash() {
        String hash = dummyPasswordHash;
        if (hash == null) {
            synchronized (this) {
                hash = dummyPasswordHash;
                if (hash == null) {
                    hash = passwordEncoder.encode("dummy-password-for-timing-equalization");
                    dummyPasswordHash = hash;
                }
            }
        }
        return hash;
    }

    @Transactional
    public User registerUser(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new RuntimeException("Email already registered");
        }
        // SECURITY: this endpoint is public/unauthenticated (see SecurityConfig).
        // Never trust a client-supplied role here — always register as DRIVER,
        // regardless of what request.getRole() contains, to prevent privilege escalation.
        User user = User.builder()
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(Role.DRIVER)
                .build();
        return userRepository.save(user);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail()).orElse(null);

        if (user == null) {
            // No such user: still perform a BCrypt comparison against a fixed
            // placeholder hash so the timing matches the "wrong password" path
            // below, and use the same generic message so the response body
            // doesn't leak whether the email is registered.
            passwordEncoder.matches(request.getPassword(), getDummyPasswordHash());
            throw new RuntimeException("Invalid email or password");
        }

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            int attempts = user.getFailedAttempts() + 1;
            user.setFailedAttempts(attempts);
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                user.setLockedUntil(Instant.now().plus(LOCK_DURATION_MINUTES, ChronoUnit.MINUTES));
            }
            userRepository.save(user);
            throw new RuntimeException("Invalid email or password");
        }

        // Only reveal lock status once the caller has proven they know the
        // correct password — otherwise an attacker without valid credentials
        // could probe account lock state.
        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw new AccountLockedException("Account is locked until " + user.getLockedUntil());
        }

        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        String rawRefreshToken = jwtService.generateRefreshToken();
        RefreshToken refreshToken = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(hashToken(rawRefreshToken))
                .familyId(UUID.randomUUID())
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(refreshToken);

        LoginResponse response = LoginResponse.builder()
                .accessToken(jwtService.generateAccessToken(user))
                .refreshToken(rawRefreshToken)
                .role(user.getRole())
                .userId(user.getId())
                .build();

        try {
            authEventPublisher.publishEvent(
                    new BaseEvent("user.login", "auth-service"), "user.login");
        } catch (Exception ignored) {}

        return response;
    }

    @Transactional
    public LoginResponse refresh(RefreshRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());

        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token"));

        if (stored.getRevoked()) {
            refreshTokenRepository.revokeAllByFamilyId(stored.getFamilyId());
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Security violation - all sessions revoked");
        }

        if (stored.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Refresh token expired");
        }

        refreshTokenRepository.revokeByTokenHash(tokenHash);

        User user = userRepository.findById(stored.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        String newRawToken = jwtService.generateRefreshToken();
        RefreshToken newToken = RefreshToken.builder()
                .userId(user.getId())
                .tokenHash(hashToken(newRawToken))
                .familyId(stored.getFamilyId())
                .expiresAt(Instant.now().plus(7, ChronoUnit.DAYS))
                .build();
        refreshTokenRepository.save(newToken);

        return LoginResponse.builder()
                .accessToken(jwtService.generateAccessToken(user))
                .refreshToken(newRawToken)
                .role(user.getRole())
                .userId(user.getId())
                .build();
    }

    @Transactional
    public void logout(RefreshRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());
        refreshTokenRepository.findByTokenHash(tokenHash)
                .ifPresent(t -> refreshTokenRepository.revokeByTokenHash(tokenHash));
    }

    public ValidateResponse validate(String authHeader) {
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Missing or invalid Authorization header");
        }
        String token = authHeader.substring(7);
        if (!jwtService.validateToken(token)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired token");
        }
        return ValidateResponse.builder()
                .userId(jwtService.extractUserId(token))
                .role(jwtService.extractRole(token))
                .email(jwtService.extractEmail(token))
                .build();
    }

    private String hashToken(String rawToken) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
