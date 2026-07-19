package com.fleettrack.auth.controller;

import com.fleettrack.auth.model.dto.CreateStaffRequest;
import com.fleettrack.auth.model.dto.StaffResponse;
import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import com.fleettrack.auth.repository.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Lets an existing ADMIN/SUPER_ADMIN create additional staff accounts (ADMIN, DISPATCHER,
 * or another SUPER_ADMIN). This is the only way such accounts get created — the public
 * /auth/register endpoint always hardcodes new signups to DRIVER (see AuthService).
 */
@RestController
@RequestMapping("/auth/staff")
@RequiredArgsConstructor
public class StaffController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private static final List<Role> STAFF_ROLES = List.of(Role.ADMIN, Role.DISPATCHER, Role.SUPER_ADMIN);
    private static final List<String> STAFF_MANAGER_ROLES = List.of("ADMIN", "SUPER_ADMIN");

    @GetMapping
    public ResponseEntity<List<StaffResponse>> listStaff(HttpServletRequest request) {
        requireRole(request, STAFF_MANAGER_ROLES);
        List<StaffResponse> staff = userRepository.findByRoleIn(STAFF_ROLES).stream()
                .map(StaffController::toResponse)
                .toList();
        return ResponseEntity.ok(staff);
    }

    @PostMapping
    public ResponseEntity<StaffResponse> createStaff(
            @Valid @RequestBody CreateStaffRequest body, HttpServletRequest request) {
        String callerRole = requireRole(request, STAFF_MANAGER_ROLES);

        if (body.getRole() == Role.DRIVER) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Use /auth/register to create driver accounts");
        }
        // Only a SUPER_ADMIN can create another SUPER_ADMIN — an ADMIN can create ADMIN or
        // DISPATCHER accounts but can't elevate a peer all the way to SUPER_ADMIN.
        if (body.getRole() == Role.SUPER_ADMIN && !"SUPER_ADMIN".equals(callerRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only a SUPER_ADMIN can create another SUPER_ADMIN account");
        }
        if (userRepository.existsByEmail(body.getEmail())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        User user = User.builder()
                .email(body.getEmail())
                .passwordHash(passwordEncoder.encode(body.getPassword()))
                .role(body.getRole())
                .build();
        User saved = userRepository.save(user);

        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    private static StaffResponse toResponse(User u) {
        return StaffResponse.builder()
                .id(u.getId())
                .email(u.getEmail())
                .role(u.getRole())
                .createdAt(u.getCreatedAt())
                .build();
    }

    private String requireRole(HttpServletRequest r, List<String> roles) {
        String role = r.getHeader("X-User-Role");
        if (role == null || !roles.contains(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return role;
    }
}
