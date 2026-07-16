package com.fleettrack.media.service;

import com.fleettrack.media.client.DriverServiceClient;
import com.fleettrack.media.client.TripServiceClient;
import com.fleettrack.media.model.dto.DriverResponse;
import com.fleettrack.media.model.dto.PhotoRegistrationRequest;
import com.fleettrack.media.model.dto.PresignRequest;
import com.fleettrack.media.model.dto.PresignResponse;
import com.fleettrack.media.model.dto.TripResponse;
import com.fleettrack.media.model.entity.Photo;
import com.fleettrack.media.model.enums.PhotoType;
import com.fleettrack.media.repository.PhotoRepository;
import io.minio.*;
import io.minio.http.Method;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@Slf4j
public class MediaService {

    private final MinioClient minioClient;
    private final MinioClient presignMinioClient;
    private final PhotoRepository photoRepository;
    private final TripServiceClient tripServiceClient;
    private final DriverServiceClient driverServiceClient;
    private final PhotoValidationService photoValidationService;

    @Value("${minio.bucket:fleettrack-media}")
    private String bucketName;

    @Value("${minio.endpoint:http://localhost:9000}")
    private String minioEndpoint;

    @Value("${minio.external-endpoint:#{null}}")
    private String minioExternalEndpoint;

    public MediaService(MinioClient minioClient,
                        @Qualifier("presignMinioClient") MinioClient presignMinioClient,
                        PhotoRepository photoRepository,
                        TripServiceClient tripServiceClient,
                        DriverServiceClient driverServiceClient,
                        PhotoValidationService photoValidationService) {
        this.minioClient = minioClient;
        this.presignMinioClient = presignMinioClient;
        this.photoRepository = photoRepository;
        this.tripServiceClient = tripServiceClient;
        this.driverServiceClient = driverServiceClient;
        this.photoValidationService = photoValidationService;
    }

    public PresignResponse generatePresignedUrl(PresignRequest request, Long userId) {
        verifyDriverOwnsTrip(request.getTripId(), userId);

        String photoKey = String.format("trips/%d/%s/%s.jpg",
                request.getTripId(),
                request.getPhotoType().name().toLowerCase(),
                UUID.randomUUID());

        try {
            Duration duration = Duration.ofMinutes(15);
            java.util.concurrent.TimeUnit timeUnit = java.util.concurrent.TimeUnit.SECONDS;

            String uploadUrl = presignMinioClient.getPresignedObjectUrl(
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
    public Photo registerPhoto(PhotoRegistrationRequest request, Long userId) {
        verifyDriverOwnsTrip(request.getTripId(), userId);
        verifyPhotoKeyBelongsToTrip(request.getTripId(), request.getPhotoKey());
        photoValidationService.validateSize(request.getFileSizeBytes());

        try {
            // Verify file exists in MinIO and grab its actual stored content-type.
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(bucketName)
                            .object(request.getPhotoKey())
                            .build()
            );
            photoValidationService.validateMimeType(request.getMimeType(), stat.contentType());

            // Stream the object once: peek the magic bytes, then stream the rest through
            // a DigestInputStream to compute the SHA-256 hash without buffering the
            // whole file in memory.
            String sha256Hash;
            try (InputStream rawStream = minioClient.getObject(
                    GetObjectArgs.builder()
                            .bucket(bucketName)
                            .object(request.getPhotoKey())
                            .build());
                 BufferedInputStream bufferedStream = new BufferedInputStream(rawStream)) {

                bufferedStream.mark(8);
                photoValidationService.validateMagicBytes(bufferedStream);
                bufferedStream.reset();

                sha256Hash = computeSHA256Streaming(bufferedStream);
            }

            // Save Photo entity
            Photo photo = Photo.builder()
                    .tripId(request.getTripId())
                    .stopId(request.getStopId())
                    .driverId(userId)
                    .photoKey(request.getPhotoKey())
                    .photoUrl(buildStoredPhotoUrl(request.getPhotoKey()))
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
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to register photo with key: {}", request.getPhotoKey(), e);
            throw new RuntimeException("Failed to register photo", e);
        }
    }

    public boolean hasPOD(Long tripId) {
        return photoRepository.existsByTripIdAndPhotoType(tripId, PhotoType.POD);
    }

    // Fresh, time-limited read link for viewing a photo (admin portal, etc.). Generated
    // on demand from presignMinioClient (already configured with the correct external
    // host), rather than trusting a URL baked in at upload time — that URL would go
    // stale the same way the upload URL did whenever this machine's network changes.
    // The bucket stays private; this is the only way to view a photo without direct
    // MinIO credentials.
    public String getPhotoViewUrl(String photoKey) {
        try {
            return presignMinioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.GET)
                            .bucket(bucketName)
                            .object(photoKey)
                            .expiry((int) Duration.ofHours(1).toSeconds())
                            .build()
            );
        } catch (Exception e) {
            log.error("Failed to generate view URL for key: {}", photoKey, e);
            return null;
        }
    }

    public Optional<Photo> getPodPhoto(Long tripId) {
        return photoRepository.findFirstByTripIdAndPhotoTypeOrderByUploadedAtDesc(tripId, PhotoType.POD);
    }

    public List<Photo> getPhotosByTrip(Long tripId) {
        return photoRepository.findByTripId(tripId);
    }

    // Confirms the caller (identified by their auth-service X-User-Id) is the driver
    // actually assigned to the trip they're uploading a photo for/about. Without this,
    // any authenticated driver could read or forge photos (including POD geotags) for
    // any other driver's trip just by guessing/incrementing the tripId.
    public void verifyDriverOwnsTrip(Long tripId, Long userId) {
        DriverResponse driverProfile = driverServiceClient.getDriverByUserId(userId);
        if (driverProfile == null || driverProfile.getId() == null) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        TripResponse trip = tripServiceClient.getTrip(tripId);
        if (trip == null || trip.getDriverId() == null
                || !trip.getDriverId().equals(driverProfile.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not assigned to this trip");
        }
    }

    // photoKey is generated by generatePresignedUrl as "trips/{tripId}/{type}/{uuid}.jpg" —
    // this guards against a driver registering a key that was presigned for a different
    // trip than the one named in the registration request.
    private void verifyPhotoKeyBelongsToTrip(Long tripId, String photoKey) {
        String expectedPrefix = "trips/" + tripId + "/";
        if (photoKey == null || !photoKey.startsWith(expectedPrefix)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Photo key does not match trip");
        }
    }

    // Config-driven, matching getPhotoViewUrl/presignMinioClient's approach — never
    // hardcode localhost, since this value is used as the view-URL fallback whenever
    // the dynamic presigned URL can't be generated.
    private String buildStoredPhotoUrl(String photoKey) {
        String base = (minioExternalEndpoint != null && !minioExternalEndpoint.isBlank())
                ? minioExternalEndpoint : minioEndpoint;
        return String.format("%s/%s/%s", base, bucketName, photoKey);
    }

    private String computeSHA256Streaming(InputStream inputStream) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            DigestInputStream digestInputStream = new DigestInputStream(inputStream, digest);
            byte[] buffer = new byte[8192];
            while (digestInputStream.read(buffer) != -1) {
                // reading through the DigestInputStream drives the running digest
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            log.error("SHA-256 algorithm not available", e);
            throw new RuntimeException("SHA-256 algorithm not available", e);
        }
    }
}
