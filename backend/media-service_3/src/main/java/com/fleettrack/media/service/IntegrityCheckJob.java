package com.fleettrack.media.service;

import com.fleettrack.media.model.entity.Photo;
import com.fleettrack.media.repository.PhotoRepository;
import io.minio.GetObjectArgs;
import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class IntegrityCheckJob {

    private final PhotoRepository photoRepository;
    private final MinioClient minioClient;

    @Value("${minio.bucket:fleettrack-media}")
    private String bucketName;

    @Scheduled(cron = "0 0 2 * * *")
    @Transactional
    public void checkPhotoIntegrity() {
        log.info("Starting nightly photo integrity check");
        
        Instant sevenDaysAgo = Instant.now().minusSeconds(7 * 24 * 60 * 60);
        List<Photo> recentPhotos = photoRepository.findByUploadedAtAfter(sevenDaysAgo).stream()
                .filter(photo -> photo.getSha256Hash() != null && !photo.getSha256Hash().isBlank())
                .filter(photo -> photo.getPhotoKey() != null && !photo.getPhotoKey().isBlank())
                .toList();

        log.info("Checking {} photos uploaded in the last 7 days", recentPhotos.size());

        int tamperedCount = 0;
        for (Photo photo : recentPhotos) {
            try {
                byte[] fileBytes = minioClient.getObject(
                        GetObjectArgs.builder()
                                .bucket(bucketName)
                                .object(photo.getPhotoKey())
                                .build()
                ).readAllBytes();

                String computedHash = computeSHA256(fileBytes);

                if (!computedHash.equals(photo.getSha256Hash())) {
                    log.warn("CRITICAL: Photo {} has been tampered with. Stored hash: {}, Computed hash: {}",
                            photo.getId(), photo.getSha256Hash(), computedHash);
                    photo.setIsTamperEvident(false);
                    photoRepository.save(photo);
                    tamperedCount++;
                }
            } catch (Exception e) {
                log.error("Failed to check integrity for photo {}", photo.getId(), e);
            }
        }

        log.info("Integrity check complete. {} photos found to be tampered", tamperedCount);
    }

    private String computeSHA256(byte[] data) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(data);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
