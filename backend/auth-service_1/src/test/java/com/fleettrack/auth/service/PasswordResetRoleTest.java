package com.fleettrack.auth.service;

import com.fleettrack.auth.email.EmailService;
import com.fleettrack.auth.model.entity.PasswordResetToken;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.PasswordResetTokenRepository;
import com.fleettrack.auth.repository.RefreshTokenRepository;
import com.fleettrack.auth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * The reset endpoint has to say whose password it just changed.
 *
 * Both the admin portal's web page and the driver app's screen POST to the same
 * /auth/reset-password, and every role now receives the same https link — the
 * email cannot carry a fleettrack:// deep link because mail clients don't
 * linkify custom schemes. The reset token is an opaque random string, so the
 * page rendering the form has no way to tell a driver from a portal user.
 *
 * Without the role in the response, the web page sent everyone to the portal's
 * sign-in screen once the reset succeeded. For a driver that is a dead end — not
 * because the credentials fail there (the portal does not gate on role), but
 * because every staff endpoint rejects a DRIVER token, so they arrive at a
 * dashboard of failed requests instead of the app they were trying to get back into.
 *
 * These tests pin the return value, because it is the only thing carrying that
 * routing decision and a `void` is very easy to restore by accident.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PasswordResetRoleTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private EmailService emailService;

    @InjectMocks private PasswordResetService passwordResetService;

    private static final String RAW_TOKEN = "a-valid-unused-token";

    /** A live token: unused, and well inside its 15-minute window. */
    private void givenValidTokenFor(Role role) {
        PasswordResetToken token = PasswordResetToken.builder()
                .userId(7L)
                .token(RAW_TOKEN)
                .expiresAt(Instant.now().plus(10, ChronoUnit.MINUTES))
                .used(false)
                .build();

        User user = User.builder()
                .id(7L)
                .email("someone@fleetsync.test")
                .passwordHash("old-hash")
                .role(role)
                .build();

        when(passwordResetTokenRepository.findByToken(RAW_TOKEN)).thenReturn(Optional.of(token));
        when(userRepository.findById(7L)).thenReturn(Optional.of(user));
        when(passwordEncoder.encode(anyString())).thenReturn("new-hash");
    }

    @Test
    @DisplayName("a driver's reset reports DRIVER, so the client sends them to the app")
    void driverResetReportsDriverRole() {
        givenValidTokenFor(Role.DRIVER);

        Role result = passwordResetService.resetPassword(RAW_TOKEN, "a-new-password");

        assertThat(result).isEqualTo(Role.DRIVER);
    }

    /**
     * The portal roles matter as much as the driver one: the fix must not flip the
     * default and start telling admins to open a phone app they don't have.
     */
    @ParameterizedTest
    @EnumSource(value = Role.class, names = {"DISPATCHER", "ADMIN", "SUPER_ADMIN"})
    @DisplayName("portal roles report themselves, and are never mistaken for a driver")
    void portalRolesAreNotReportedAsDriver(Role role) {
        givenValidTokenFor(role);

        Role result = passwordResetService.resetPassword(RAW_TOKEN, "a-new-password");

        assertThat(result).isEqualTo(role).isNotEqualTo(Role.DRIVER);
    }
}
