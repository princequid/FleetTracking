package com.fleettrack.gps.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "gps_pings")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GpsPing {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "trip_id", nullable = false)
    private Long tripId;

    @Column(name = "driver_id", nullable = false)
    private Long driverId;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal lat;

    @Column(nullable = false, precision = 10, scale = 7)
    private BigDecimal lng;

    @Column(name = "speed_kmh")
    private BigDecimal speedKmh;

    private BigDecimal heading;

    @Column(name = "accuracy_m")
    private BigDecimal accuracyM;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    @Column(name = "received_at")
    private Instant receivedAt;

    @Column(name = "is_offline_ping")
    @Builder.Default
    private Boolean isOfflinePing = false;

    @Column(name = "sequence_no")
    private Integer sequenceNo;

    @Column(name = "validation_flag", length = 30)
    private String validationFlag;

    @PrePersist
    void onCreate() {
        this.receivedAt = Instant.now();
    }
}
