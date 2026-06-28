package com.fleettrack.media.service;

import com.fleettrack.media.model.dto.PhotoRegistrationRequest;
import com.fleettrack.media.model.dto.PresignRequest;
import com.fleettrack.media.model.dto.PresignResponse;
import com.fleettrack.media.model.entity.Photo;
import com.fleettrack.media.model.enums.PhotoType;
import com.fleettrack.media.repository.PhotoRepository;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MediaService {

    private final MinioClient minioClient;
    private final PhotoRepository photoRepository;

    @Value("${minio.bucket:fleettrack-media}")
    private String bucketName;

    public PresignResponse generatePresignedUrl(PresignRequest request, Long driverId) {
        String photoKey = String.format("trips/%d/%s/%s.jpg",
                request.getTripId(),
                request.getPhotoType().name().toLowerCase(),
                UUID.randomUUID());

        try {
            Duration duration = Duration.ofMinutes(15);
            java.util.concurrent.TimeUnit timeUnit = java.util.concurrent.TimeUnit.SECONDS;

            String uploadUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(bucketName)
                            .object(photoKey)
                            .expiry((int) duration.toSeconds(), timeUnit)
                            .build()
            );

            return PresignResponse.builder()
                    .uploadUrl(uploadUrl)
                    .photoKey(photoKey)
                    .expiresIn(900)
                    .build();
        } catch (Exception e) {
            log.error("Failed to generate presigned URL for key: {}", photoKey, e);
            throw new RuntimeException("Failed to generate presigned URL", e);
        }
    }

    @Transactional
    public Photo registerPhoto(PhotoRegistrationRequest request, Long driverId) {
        try {
            // Verify file exists in MinIO
            minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(request.getPhotoKey())
                            .build()
            );

            // Download file to compute SHA-256
            byte[] fileBytes = minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(request.getPhotoKey())
                            .build()
            ).readAllBytes();

            // Compute SHA-256 hash
            String sha256Hash = computeSHA256(fileBytes);

            // Save Photo entity
            Photo photo = Photo.builder()
                    .tripId(request.getTripId())
                    .driverId(driverId)
                    .photoKey(request.getPhotoKey())
                    .photoUrl(String.format("http://localhost:9000/%s/%s", bucketName, request.getPhotoKey()))
                    .photoType(request.getPhotoType())
                    .mimeType(request.getMimeType())
                    .fileSizeBytes(request.getFileSizeBytes())
                    .lat(request.getLat())
                    .lng(request.getLng())
                    .takenAt(request.getTakenAt())
                    .sha256Hash(sha256Hash)
                    .isTamperEvident(true)
                    .uploadedAt(Instant.now())
                    .build();

            return photoRepository.save(photo);
        } catch (Exception e) {
            log.error("Failed to register photo with key: {}", request.getPhotoKey(), e);
            throw new RuntimeException("Failed to register photo", e);
        }
    }

    public boolean hasPOD(Long tripId) {
        return photoRepository.existsByTripIdAndPhotoType(tripId, PhotoType.POD);
    }

    public List<Photo> getPhotosByTrip(Long tripId) {
        return photoRepository.findByTripId(tripId);
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
