package com.fleettrack.auth.config;

import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Creates the very first SUPER_ADMIN account from INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD
 * env vars, so a freshly deployed environment isn't otherwise stuck with no way to log in as
 * an admin (registration is deliberately hardcoded to DRIVER — see AuthService.registerUser).
 *
 * Runs on every boot but is a no-op once any SUPER_ADMIN exists, so it's safe to leave the
 * env vars set permanently — this never overwrites or duplicates an admin account.
 */
@Component
@RequiredArgsConstructor
public class InitialAdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(InitialAdminBootstrap.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.initial-admin.email:}")
    private String initialAdminEmail;

    @Value("${app.initial-admin.password:}")
    private String initialAdminPassword;

    @Override
    public void run(ApplicationArguments args) {
        if (initialAdminEmail == null || initialAdminEmail.isBlank()
                || initialAdminPassword == null || initialAdminPassword.isBlank()) {
            return;
        }
        if (userRepository.existsByRole(Role.SUPER_ADMIN)) {
            return;
        }
        if (userRepository.existsByEmail(initialAdminEmail)) {
            log.warn("INITIAL_ADMIN_EMAIL ({}) is already registered to a non-admin account — "
                    + "skipping initial admin creation.", initialAdminEmail);
            return;
        }

        User admin = User.builder()
                .email(initialAdminEmail)
                .passwordHash(passwordEncoder.encode(initialAdminPassword))
                .role(Role.SUPER_ADMIN)
                .build();
        userRepository.save(admin);
        log.info("Created initial SUPER_ADMIN account for {}", initialAdminEmail);
    }
}
