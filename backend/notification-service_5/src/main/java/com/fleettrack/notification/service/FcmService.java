package com.fleettrack.notification.service;

import com.fleettrack.notification.model.entity.DeviceToken;
import com.fleettrack.notification.repository.DeviceTokenRepository;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Sends push notifications to a recipient's registered devices via Firebase Cloud
 * Messaging. No-ops safely when Firebase isn't configured (see FirebaseConfig), so the
 * rest of the notification pipeline works with or without push credentials.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class FcmService {

    private final DeviceTokenRepository deviceTokenRepository;

    private boolean pushEnabled() {
        return !FirebaseApp.getApps().isEmpty();
    }

    /**
     * Deliver a push to every device registered for the recipient.
     * `data` becomes the notification payload the app reads for deep-linking
     * (e.g. type, tripId, notificationId) — all values must be strings.
     */
    @Transactional
    public void sendToRecipient(Long recipientId, String title, String body, Map<String, String> data) {
        if (recipientId == null) return;
        if (!pushEnabled()) {
            log.debug("Push disabled (Firebase not configured) — skipping send to {}", recipientId);
            return;
        }

        List<DeviceToken> devices = deviceTokenRepository.findByRecipientId(recipientId);
        if (devices.isEmpty()) return;

        Map<String, String> payload = data != null ? new HashMap<>(data) : new HashMap<>();

        for (DeviceToken device : devices) {
            try {
                Message message = Message.builder()
                        .setToken(device.getToken())
                        .setNotification(Notification.builder()
                                .setTitle(title)
                                .setBody(body)
                                .build())
                        .putAllData(payload)
                        .setAndroidConfig(AndroidConfig.builder()
                                .setPriority(AndroidConfig.Priority.HIGH)
                                .setNotification(AndroidNotification.builder()
                                        .setChannelId("default")
                                        .setSound("default")
                                        .build())
                                .build())
                        .setApnsConfig(ApnsConfig.builder()
                                .setAps(Aps.builder().setSound("default").build())
                                .build())
                        .build();

                FirebaseMessaging.getInstance().send(message);
            } catch (FirebaseMessagingException e) {
                // Remove tokens FCM tells us are dead so we stop pushing to them.
                MessagingErrorCode code = e.getMessagingErrorCode();
                if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                    deviceTokenRepository.deleteByToken(device.getToken());
                    log.info("Removed invalid device token for recipient {}", recipientId);
                } else {
                    log.warn("FCM send failed (code={}) for recipient {}", code, recipientId);
                }
            } catch (Exception e) {
                log.warn("Unexpected error sending push to recipient {}: {}", recipientId, e.getMessage());
            }
        }
    }
}
