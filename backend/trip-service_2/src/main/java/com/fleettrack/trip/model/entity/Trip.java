package com.fleettrack.trip.model.entity;

import com.fleettrack.trip.model.enums.TripStatus;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "trips")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Trip {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "driver_id", nullable = false)
    private Long driverId;

    @Column(name = "vehicle_id", nullable = false)
    private Long vehicleId;

    @Column(length = 500)
    private String origin;

    @Column(length = 500)
    private String destination;

    @Column(name = "origin_lat", precision = 10, scale = 7)
    private BigDecimal originLat;

    @Column(name = "origin_lng", precision = 10, scale = 7)
    private BigDecimal originLng;

    @Column(name = "dest_lat", precision = 10, scale = 7)
    private BigDecimal destLat;

    @Column(name = "dest_lng", precision = 10, scale = 7)
    private BigDecimal destLng;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private TripStatus status = TripStatus.ASSIGNED;

    private Instant eta;

    @Column(name = "route_geometry", columnDefinition = "TEXT")
    private String routeGeometry;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "arrived_at")
    private Instant arrivedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @PrePersist
    void onCreate() {
        this.createdAt = Instant.now();
    }
}
