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

    @Transactional
    public void unregister(String token) {
        if (token != null && !token.isBlank()) repository.deleteByToken(token);
    }
}
