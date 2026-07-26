package com.fleettrack.auth.service;

import com.fleettrack.auth.email.EmailService;
import com.fleettrack.auth.email.EmailTemplates;
import com.fleettrack.auth.model.entity.PasswordResetToken;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.PasswordResetTokenRepository;
import com.fleettrack.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
@Slf4j
public class PasswordResetService {

    private static final int RESET_TOKEN_TTL_MINUTES = 15;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    @Value("${fleetsync.frontend-url}")
    private String frontendUrl;

    @Value("${fleetsync.mobile-app-scheme:fleettrack}")
    private String mobileAppScheme;

    /**
     * Always succeeds from the caller's point of view (the controller returns 200
     * regardless) — an unknown email silently does nothing so this endpoint can't be
     * used to enumerate registered accounts.
     */
    @Transactional
    public void requestReset(String email) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            log.debug("Password reset requested for unknown email");
            return;
        }

        String rawToken = createToken(user.getId(), RESET_TOKEN_TTL_MINUTES, ChronoUnit.MINUTES);

        // Drivers only ever use the mobile app, never the admin portal — send them a
        // deep link straight into it. Everyone else (dispatcher/admin/super_admin) only
        // ever uses the web admin portal, so they get the web reset-password page.
        String resetLink = user.getRole() == Role.DRIVER
                ? mobileAppScheme + "://reset-password?token=" + rawToken
                : frontendUrl + "/reset-password?token=" + rawToken;
        emailService.sendEmail(user.getEmail(), "Reset your FleetSync password",
                EmailTemplates.buildPasswordResetEmail(resetLink));
    }

    @Transactional
    public void resetPassword(String token, String newPassword) {
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(token).orElse(null);

        if (resetToken == null
                || Boolean.TRUE.equals(resetToken.getUsed())
                || resetToken.getExpiresAt().isBefore(Instant.now())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired reset link");
        }

        User user = userRepository.findById(resetToken.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid or expired reset link"));

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        // A driver resetting their password this way has, incidentally, also satisfied
        // the "set your own password" first-login requirement — don't make them do it
        // again in-app right after.
        user.setMustChangePassword(false);
        userRepository.save(user);

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);
    }

    // A new token invalidates any previous one still sitting in the user's inbox.
    private String createToken(Long userId, int ttlAmount, ChronoUnit ttlUnit) {
        passwordResetTokenRepository.deleteByUserId(userId);

        String rawToken = generateToken();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .userId(userId)
                .token(rawToken)
                .expiresAt(Instant.now().plus(ttlAmount, ttlUnit))
                .used(false)
                .build();
        passwordResetTokenRepository.save(resetToken);
        return rawToken;
    }

    private String generateToken() {
        byte[] bytes = new byte[32];
        SECURE_RANDOM.nextBytes(bytes);
        return HexFormat.of().formatHex(bytes);
    }
}
