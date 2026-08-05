package com.fleettrack.auth.service;

import com.fleettrack.auth.email.EmailService;
import com.fleettrack.auth.email.EmailTemplates;
import com.fleettrack.auth.model.entity.PasswordResetToken;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.PasswordResetTokenRepository;
import com.fleettrack.auth.repository.RefreshTokenRepository;
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
    private final RefreshTokenRepository refreshTokenRepository;
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

        // Everyone gets the https web link, drivers included.
        //
        // Drivers previously got `fleettrack://reset-password?token=...` directly.
        // That address is valid — the app registers the scheme and the screen reads
        // the token correctly — but mail clients do not linkify custom URI schemes.
        // Gmail and Outlook render it as dead text or strip the href entirely, so
        // the button was unclickable and the flow appeared to do nothing at all.
        //
        // An https link is clickable everywhere. The reset page then offers to hand
        // off into the app via the deep link, which works from a browser because
        // browsers *do* honour custom schemes.
        String resetLink = frontendUrl + "/reset-password?token=" + rawToken;

        emailService.sendEmail(user.getEmail(), "Reset your FleetSync password",
                EmailTemplates.buildPasswordResetEmail(resetLink, user.getRole() == Role.DRIVER));
    }

    /**
     * @return the role of the account whose password was just reset.
     *
     * The caller needs it to decide where to send the user next, and only the
     * server can answer: the reset link carries an opaque random token, so the
     * page rendering the form has no idea whether it belongs to a driver or to
     * a portal user. Without this, the web reset page sent everyone to the
     * admin portal's sign-in — including drivers, who have no portal account
     * and belong back in the mobile app.
     *
     * Safe to return: the recipient has just proved possession of a valid,
     * unexpired, unused reset token for this account.
     */
    @Transactional
    public Role resetPassword(String token, String newPassword) {
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

        // Evict every existing session. Password reset is the primary remedy a
        // user reaches for when they believe their account is compromised — and
        // without this it did not remove the attacker: a stolen refresh token
        // stayed valid for its full 7-day window and could be rotated
        // indefinitely via the public /auth/refresh endpoint.
        refreshTokenRepository.revokeAllByUserId(user.getId());

        resetToken.setUsed(true);
        passwordResetTokenRepository.save(resetToken);

        return user.getRole();
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
