package com.fleettrack.auth.service;

import com.fleettrack.auth.email.EmailService;
import com.fleettrack.auth.email.EmailTemplates;
import com.fleettrack.auth.event.AuthEventPublisher;
import com.fleettrack.auth.exception.AccountLockedException;
import com.fleettrack.auth.model.dto.*;
import com.fleettrack.auth.model.entity.KnownDevice;
import com.fleettrack.auth.model.entity.RefreshToken;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.KnownDeviceRepository;
import com.fleettrack.auth.repository.RefreshTokenRepository;
import com.fleettrack.auth.repository.UserRepository;
import com.fleettrack.events.BaseEvent;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.format.DateTimeFormatter;
import java.time.ZoneOffset;

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
    private final KnownDeviceRepository knownDeviceRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthEventPublisher authEventPublisher;
    private final EmailService emailService;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final int LOCK_DURATION_MINUTES = 15;
    private static final DateTimeFormatter LOGIN_TIME_FORMAT =
            DateTimeFormatter.ofPattern("MMM d, yyyy 'at' HH:mm 'UTC'").withZone(ZoneOffset.UTC);

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
                // The password on this request was set by whoever filled out the form —
                // in practice, the admin portal's "Add Driver" flow, on the driver's
                // behalf — and is usable immediately. This flag just forces the in-app
                // first-login prompt so the driver can set their own password (or keep
                // this one) the first time they log in.
                .mustChangePassword(true)
                .build();
        User saved = userRepository.save(user);

        // Best-effort and non-blocking (EmailService.sendEmail is @Async) — a slow or
        // failed send must never delay or fail the registration response.
        // RegisterRequest has no name field (self-registration only collects email +
        // password), so the email address itself is the closest thing to a display name.
        emailService.sendEmail(saved.getEmail(), "Welcome to FleetSync",
                EmailTemplates.buildWelcomeEmail(saved.getEmail(), saved.getRole().name()));

        return saved;
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

        boolean locked = user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now());
        boolean passwordOk = passwordEncoder.matches(request.getPassword(), user.getPasswordHash());

        // The lock is enforced BEFORE the password result is acted on. Previously
        // it was only checked after a successful match, so a locked account still
        // accepted unlimited guesses — the lockout blocked the legitimate user
        // while doing nothing to the attacker.
        //
        // Lock state is still not disclosed to a caller who cannot supply the
        // password (the original reason for the late check): a wrong password
        // against a locked account returns the same generic message as any other
        // failure. Only a caller who proved they know the password is told the
        // account is locked. Attempts are not incremented while locked, so an
        // attacker cannot keep extending the lock window on someone else.
        if (locked) {
            if (passwordOk) {
                throw new AccountLockedException("Account is locked until " + user.getLockedUntil());
            }
            throw new RuntimeException("Invalid email or password");
        }

        if (!passwordOk) {
            // Atomic increment — a read-modify-write here is lost-update prone,
            // which let parallel guessing exceed MAX_FAILED_ATTEMPTS without ever
            // tripping the lock.
            userRepository.incrementFailedAttempts(user.getId());
            int attempts = user.getFailedAttempts() + 1;
            if (attempts >= MAX_FAILED_ATTEMPTS) {
                userRepository.lockUntil(
                        user.getId(),
                        Instant.now().plus(LOCK_DURATION_MINUTES, ChronoUnit.MINUTES));
            }
            throw new RuntimeException("Invalid email or password");
        }

        user.setFailedAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);

        checkKnownDevice(user, request.getDeviceFingerprint());

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
                .mustChangePassword(user.getMustChangePassword())
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

    /**
     * Resolves the one-time first-login prompt (see User.mustChangePassword): a
     * {@code newPassword} changes it, {@code null}/blank just dismisses the prompt and
     * keeps the existing password. Either way the flag is cleared so it never shows
     * again. {@code userId} comes from X-User-Id, which the gateway sets only after
     * validating the caller's JWT — this endpoint is deliberately NOT public.
     */
    @Transactional
    public void firstLoginAck(Long userId, String newPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (newPassword != null && !newPassword.isBlank()) {
            if (newPassword.length() < 8) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Password must be at least 8 characters");
            }
            user.setPasswordHash(passwordEncoder.encode(newPassword));
            // Changing the password must invalidate other sessions, for the same
            // reason as the reset flow — otherwise a token stolen before the
            // change keeps working for its full 7-day lifetime.
            refreshTokenRepository.revokeAllByUserId(user.getId());
        }
        user.setMustChangePassword(false);
        userRepository.save(user);
    }

    /**
     * Web clients (the admin portal) don't send a fingerprint today, so this is a
     * no-op for them until one is wired up — only mobile (which generates and
     * persists a UUID in SecureStore) currently participates in device tracking.
     */
    private void checkKnownDevice(User user, String deviceFingerprint) {
        if (deviceFingerprint == null || deviceFingerprint.isBlank()) return;

        KnownDevice existing = knownDeviceRepository
                .findByUserIdAndDeviceFingerprint(user.getId(), deviceFingerprint)
                .orElse(null);

        if (existing != null) {
            existing.setLastSeenAt(Instant.now());
            knownDeviceRepository.save(existing);
            return;
        }

        knownDeviceRepository.save(KnownDevice.builder()
                .userId(user.getId())
                .deviceFingerprint(deviceFingerprint)
                .build());

        emailService.sendEmail(user.getEmail(), "New sign-in to your FleetSync account",
                EmailTemplates.buildNewDeviceLoginEmail(user.getEmail(), LOGIN_TIME_FORMAT.format(Instant.now())));
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
