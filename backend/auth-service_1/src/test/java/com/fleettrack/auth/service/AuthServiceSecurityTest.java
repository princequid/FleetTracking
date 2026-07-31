package com.fleettrack.auth.service;

import com.fleettrack.auth.email.EmailService;
import com.fleettrack.auth.event.AuthEventPublisher;
import com.fleettrack.auth.exception.AccountLockedException;
import com.fleettrack.auth.model.dto.LoginRequest;
import com.fleettrack.auth.model.dto.RegisterRequest;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.KnownDeviceRepository;
import com.fleettrack.auth.repository.RefreshTokenRepository;
import com.fleettrack.auth.repository.UserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Regression guards for the auth security fixes.
 *
 * These are deliberately the first tests in this repository: each one pins a
 * defect that was found in a security audit, and two of them cover Criticals
 * that were already fixed once. Without an executable assertion, nothing stops
 * a future refactor quietly reintroducing them.
 *
 * No Spring context, no database, no Docker — pure logic, runs in milliseconds.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AuthServiceSecurityTest {

    @Mock private UserRepository userRepository;
    @Mock private RefreshTokenRepository refreshTokenRepository;
    @Mock private KnownDeviceRepository knownDeviceRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtService jwtService;
    @Mock private AuthEventPublisher authEventPublisher;
    @Mock private EmailService emailService;

    @InjectMocks private AuthService authService;

    private static final String EMAIL = "driver@fleettrack.test";
    private static final String HASH = "$2a$12$storedhashvalue";

    private User userWith(int failedAttempts, Instant lockedUntil) {
        User u = User.builder()
                .email(EMAIL)
                .passwordHash(HASH)
                .role(Role.DRIVER)
                .failedAttempts(failedAttempts)
                .lockedUntil(lockedUntil)
                .build();
        u.setId(1L);
        return u;
    }

    // ── Privilege escalation ────────────────────────────────────────────────

    /**
     * /auth/register is public. A client-supplied role must never be honoured, or
     * anyone can mint themselves a SUPER_ADMIN over the whole fleet.
     */
    @ParameterizedTest(name = "client asks for role \"{0}\" -> persisted as DRIVER")
    @ValueSource(strings = {"SUPER_ADMIN", "ADMIN", "DISPATCHER", "driver", "not-a-role", ""})
    @DisplayName("register ignores any client-supplied role and always persists DRIVER")
    void registerAlwaysPersistsDriverRole(String requestedRole) {
        RegisterRequest request = new RegisterRequest();
        request.setEmail(EMAIL);
        request.setPassword("correct-horse-battery");
        setRoleIfPresent(request, requestedRole);

        when(userRepository.existsByEmail(EMAIL)).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn(HASH);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        authService.registerUser(request);

        ArgumentCaptor<User> saved = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(saved.capture());
        assertThat(saved.getValue().getRole())
                .as("a public endpoint must never let the caller choose their own role")
                .isEqualTo(Role.DRIVER);
    }

    /** RegisterRequest may or may not expose a role field; tolerate both. */
    private void setRoleIfPresent(RegisterRequest request, String role) {
        try {
            RegisterRequest.class.getMethod("setRole", String.class).invoke(request, role);
        } catch (ReflectiveOperationException ignored) {
            // No role field on the DTO — the escalation vector doesn't exist at all,
            // which satisfies this test's intent by construction.
        }
    }

    // ── Account lockout ordering ────────────────────────────────────────────

    /**
     * The lock used to be checked only AFTER a successful password match, so a
     * locked account still accepted unlimited guesses — it blocked the legitimate
     * user and did nothing to the attacker.
     */
    @Test
    @DisplayName("locked account rejects a wrong password without counting the attempt")
    void lockedAccountDoesNotCountFurtherAttempts() {
        User locked = userWith(5, Instant.now().plus(15, ChronoUnit.MINUTES));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(locked));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(loginWith("wrong-password")))
                .isInstanceOf(RuntimeException.class)
                // Must NOT reveal that the account is locked to someone who cannot
                // supply the password — that would leak lock state to an attacker.
                .hasMessageContaining("Invalid email or password");

        verify(userRepository, never()).incrementFailedAttempts(anyLong());
        verify(userRepository, never()).lockUntil(anyLong(), any());
    }

    /**
     * The legitimate owner — who can prove they know the password — should be told
     * why they are being refused.
     */
    @Test
    @DisplayName("locked account tells the real owner it is locked")
    void lockedAccountRevealsLockToCorrectPassword() {
        User locked = userWith(5, Instant.now().plus(15, ChronoUnit.MINUTES));
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(locked));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(true);

        assertThatThrownBy(() -> authService.login(loginWith("correct-password")))
                .isInstanceOf(AccountLockedException.class);
    }

    /**
     * A read-modify-write on the loaded entity is lost-update prone under parallel
     * attempts, which let an attacker exceed the limit without tripping the lock.
     */
    @Test
    @DisplayName("failed attempt increments atomically, not via entity save")
    void failedAttemptUsesAtomicIncrement() {
        User active = userWith(0, null);
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(active));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(loginWith("wrong-password")))
                .hasMessageContaining("Invalid email or password");

        verify(userRepository).incrementFailedAttempts(1L);
    }

    @Test
    @DisplayName("reaching the attempt limit sets a lock")
    void reachingLimitLocksAccount() {
        User nearlyLocked = userWith(4, null); // 5th failure trips it
        when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(nearlyLocked));
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(loginWith("wrong-password")))
                .hasMessageContaining("Invalid email or password");

        verify(userRepository).lockUntil(anyLong(), any(Instant.class));
    }

    // ── User enumeration ────────────────────────────────────────────────────

    /**
     * An unknown email must be indistinguishable from a wrong password, or the
     * login endpoint becomes an account-enumeration oracle.
     */
    @Test
    @DisplayName("unknown email returns the same message as a wrong password")
    void unknownEmailIsIndistinguishable() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(passwordEncoder.matches(anyString(), anyString())).thenReturn(false);

        assertThatThrownBy(() -> authService.login(loginWith("anything")))
                .hasMessageContaining("Invalid email or password");
    }

    private LoginRequest loginWith(String password) {
        LoginRequest request = new LoginRequest();
        request.setEmail(EMAIL);
        request.setPassword(password);
        return request;
    }
}
