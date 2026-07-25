package com.fleettrack.notification.repository;

import com.fleettrack.notification.model.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, Long> {

    List<DeviceToken> findByRecipientId(Long recipientId);

    Optional<DeviceToken> findByToken(String token);

    void deleteByToken(String token);
}
