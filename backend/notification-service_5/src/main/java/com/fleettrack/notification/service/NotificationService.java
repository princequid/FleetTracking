package com.fleettrack.notification.service;

import com.fleettrack.notification.model.dto.NotificationResponse;
import com.fleettrack.notification.model.entity.Notification;
import com.fleettrack.notification.model.enums.NotificationType;
import com.fleettrack.notification.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final FcmService fcmService;

    @Transactional(readOnly = true)
    public List<NotificationResponse> listForUser(Long recipientId) {
        return notificationRepository.findByRecipientIdOrderByCreatedAtDesc(recipientId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long recipientId) {
        return notificationRepository.countByRecipientIdAndIsReadFalse(recipientId);
    }

    @Transactional
    public void markRead(Long id) {
        notificationRepository.findById(id).ifPresent(n -> {
            n.setIsRead(true);
            notificationRepository.save(n);
        });
    }

    /** Used by the controller to authorize PUT /{id}/read against the calling user. */
    @Transactional(readOnly = true)
    public boolean belongsToRecipient(Long id, Long recipientId) {
        return notificationRepository.existsByIdAndRecipientId(id, recipientId);
    }

    @Transactional
    public void markAllRead(Long recipientId) {
        List<Notification> unread = notificationRepository.findByRecipientIdAndIsReadFalse(recipientId);
        unread.forEach(n -> n.setIsRead(true));
        notificationRepository.saveAll(unread);
    }

    /**
     * Persist a notification created from a domain event. De-duplicated by eventId so
     * a redelivered message never creates a second notification.
     */
    @Transactional
    public void createFromEvent(UUID eventId, Long recipientId, NotificationType type,
                                String title, String message, Long tripId) {
        if (recipientId == null) {
            log.warn("Skipping notification with no recipient (type={}, event={})", type, eventId);
            return;
        }
        if (eventId != null && notificationRepository.existsByEventId(eventId)) {
            log.debug("Skipping duplicate notification for event {}", eventId);
            return;
        }
        Notification n = Notification.builder()
                .recipientId(recipientId)
                .type(type)
                .title(title)
                .message(message)
                .tripId(tripId)
                .eventId(eventId)
                .isRead(false)
                .build();
        notificationRepository.save(n);
        log.info("Created notification type={} recipient={} trip={}", type, recipientId, tripId);

        // Also deliver as a push. Payload carries type/tripId/notificationId so the app
        // can deep-link when the notification is tapped. No-ops if push isn't configured.
        Map<String, String> data = new HashMap<>();
        data.put("type", type != null ? type.name() : "INFO");
        if (tripId != null) data.put("tripId", String.valueOf(tripId));
        data.put("notificationId", String.valueOf(n.getId()));
        fcmService.sendToRecipient(recipientId, title, message, data);
    }
}
