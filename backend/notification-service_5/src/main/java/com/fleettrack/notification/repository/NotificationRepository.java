package com.fleettrack.notification.repository;

import com.fleettrack.notification.model.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByRecipientIdOrderByCreatedAtDesc(Long recipientId);

    long countByRecipientIdAndIsReadFalse(Long recipientId);

    List<Notification> findByRecipientIdAndIsReadFalse(Long recipientId);

    boolean existsByEventId(UUID eventId);
}
