package com.fleettrack.notification.service;

import com.fleettrack.notification.model.entity.DeviceToken;
import com.fleettrack.notification.repository.DeviceTokenRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {

    private final DeviceTokenRepository repository;

    /** Register (or re-point) a device token to a recipient. Idempotent per token. */
    @Transactional
    public void register(Long recipientId, String token, String platform) {
        if (recipientId == null || token == null || token.isBlank()) return;
        repository.findByToken(token).ifPresentOrElse(
            existing -> {
                existing.setRecipientId(recipientId);
                existing.setPlatform(platform);
                repository.save(existing);
            },
            () -> repository.save(DeviceToken.builder()
                    .recipientId(recipientId)
                    .token(token)
                    .platform(platform)
                    .build())
        );
        log.debug("Registered device token for recipient {}", recipientId);
    }

    /**
     * Removes a token only if it belongs to the given recipient.
     *
     * Deliberately silent when the token is absent or owned by someone else: a
     * 404-vs-204 distinction here would let a caller probe whether an arbitrary
     * token exists. The caller's own tokens are removed; nothing else changes.
     */
    @Transactional
    public void unregisterForUser(Long recipientId, String token) {
        if (recipientId == null || token == null || token.isBlank()) return;
        repository.findByToken(token)
                .filter(existing -> recipientId.equals(existing.getRecipientId()))
                .ifPresent(repository::delete);
    }
}
