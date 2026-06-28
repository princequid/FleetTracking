package com.fleettrack.vehicle.model.entity;

import com.fleettrack.vehicle.model.enums.VehicleStatus;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.Instant;

@Entity @Table(name = "vehicles")
@Getter @Setter @Builder @NoArgsConstructor @AllArgsConstructor
public class Vehicle {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "plate_number", nullable = false, unique = true, length = 20)
    private String plateNumber;
    @Column(length = 100)
    private String model;
    private BigDecimal capacity;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20) @Builder.Default
    private VehicleStatus status = VehicleStatus.AVAILABLE;
    @Column(name = "created_at") private Instant createdAt;
    @Column(name = "updated_at") private Instant updatedAt;
    @PrePersist void onCreate() { createdAt = updatedAt = Instant.now(); }
    @PreUpdate void onUpdate() { updatedAt = Instant.now(); }
}
