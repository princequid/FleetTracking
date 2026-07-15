package com.fleettrack.media.model.entity;

import com.fleettrack.media.model.enums.PhotoType;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "photos")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Photo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_id", nullable = false)
    private Long tripId;

    // Set only for STOP_POD photos — identifies which intermediate stop the proof-of-
    // delivery was captured at. Null for destination POD / pre-dispatch / other types.
    @Column(name = "stop_id")
    private Long stopId;

    @Column(name = "driver_id", nullable = false)
    private Long driverId;

    @Column(name = "photo_key", length = 500)
    private String photoKey;

    @Column(name = "photo_url", columnDefinition = "TEXT")
    private String photoUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "photo_type", nullable = false, length = 20)
    private PhotoType photoType;

    @Column(name = "mime_type", length = 50)
    private String mimeType;

    @Column(name = "file_size_bytes")
    private Long fileSizeBytes;

    @Column(name = "lat", precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(name = "lng", precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "taken_at")
    private Instant takenAt;

    @Column(name = "sha256_hash", length = 64)
    private String sha256Hash;

    @Column(name = "is_tamper_evident")
    private Boolean isTamperEvident = true;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "uploaded_at")
    private Instant uploadedAt;
}
