package com.fleettrack.auth.repository;

import com.fleettrack.auth.model.entity.KnownDevice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface KnownDeviceRepository extends JpaRepository<KnownDevice, Long> {
    Optional<KnownDevice> findByUserIdAndDeviceFingerprint(Long userId, String deviceFingerprint);
}
