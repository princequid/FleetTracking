package com.fleettrack.auth.repository;

import com.fleettrack.auth.model.entity.User;
import com.fleettrack.auth.model.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    boolean existsByRole(Role role);
    List<User> findByRoleIn(List<Role> roles);

    /**
     * Atomic counter bump. A read-modify-write on the loaded entity is lost-update
     * prone under parallel login attempts, which let an attacker exceed
     * MAX_FAILED_ATTEMPTS without ever tripping the lockout.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.failedAttempts = u.failedAttempts + 1 WHERE u.id = :userId")
    void incrementFailedAttempts(@Param("userId") Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("UPDATE User u SET u.lockedUntil = :until WHERE u.id = :userId")
    void lockUntil(@Param("userId") Long userId, @Param("until") Instant until);
}
