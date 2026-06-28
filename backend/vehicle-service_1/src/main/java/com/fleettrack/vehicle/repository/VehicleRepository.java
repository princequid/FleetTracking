package com.fleettrack.vehicle.repository;

import com.fleettrack.vehicle.model.entity.Vehicle;
import com.fleettrack.vehicle.model.enums.VehicleStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface VehicleRepository extends JpaRepository<Vehicle, Long> {
    List<Vehicle> findByStatus(VehicleStatus status);
    Optional<Vehicle> findByPlateNumber(String plateNumber);
    boolean existsByPlateNumber(String plateNumber);
}
