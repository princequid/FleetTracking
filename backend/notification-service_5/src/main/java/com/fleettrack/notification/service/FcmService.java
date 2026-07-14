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

    // Transient FCM errors are worth a couple of quick retries; everything else
    // (bad token, invalid argument, quota, auth, etc.) is permanent and should fail fast.
    private static final int MAX_ATTEMPTS = 3;
    private static final long RETRY_BACKOFF_MS = 250;

    private final DeviceTokenRepository deviceTokenRepository;

    private boolean pushEnabled() {
        return !FirebaseApp.getApps().isEmpty();
    }

    private boolean isRetryable(MessagingErrorCode code) {
        return code == MessagingErrorCode.UNAVAILABLE || code == MessagingErrorCode.INTERNAL;
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

            sendWithRetry(device, message, recipientId);
        }
    }

    /** Sends a single message, retrying transient FCM errors a few times before giving up. */
    private void sendWithRetry(DeviceToken device, Message message, Long recipientId) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                FirebaseMessaging.getInstance().send(message);
                return;
            } catch (FirebaseMessagingException e) {
                MessagingErrorCode code = e.getMessagingErrorCode();
                // Remove tokens FCM tells us are dead so we stop pushing to them.
                if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                    deviceTokenRepository.deleteByToken(device.getToken());
                    log.info("Removed invalid device token for recipient {}", recipientId);
                    return;
                }
                if (isRetryable(code) && attempt < MAX_ATTEMPTS) {
                    log.warn("FCM send failed (code={}) for recipient {}, retrying (attempt {}/{})",
                            code, recipientId, attempt, MAX_ATTEMPTS);
                    sleepBeforeRetry(attempt);
                    continue;
                }
                log.warn("FCM send failed (code={}) for recipient {} after {} attempt(s)",
                        code, recipientId, attempt);
                return;
            } catch (Exception e) {
                log.warn("Unexpected error sending push to recipient {}: {}", recipientId, e.getMessage());
                return;
            }
        }
    }

    private void sleepBeforeRetry(int attempt) {
        try {
            // Simple linear backoff: 250ms, 500ms, ...
            Thread.sleep(RETRY_BACKOFF_MS * attempt);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
