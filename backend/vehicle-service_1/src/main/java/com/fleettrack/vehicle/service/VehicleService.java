package com.fleettrack.vehicle.service;

import com.fleettrack.vehicle.model.dto.VehicleRequest;
import com.fleettrack.vehicle.model.dto.VehicleResponse;
import com.fleettrack.vehicle.model.entity.Vehicle;
import com.fleettrack.vehicle.model.enums.VehicleStatus;
import com.fleettrack.vehicle.repository.VehicleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

@Service @RequiredArgsConstructor
public class VehicleService {
    private final VehicleRepository vehicleRepository;

    @Transactional
    public VehicleResponse createVehicle(VehicleRequest req) {
        if (vehicleRepository.existsByPlateNumber(req.getPlateNumber()))
            throw new RuntimeException("Vehicle with plate " + req.getPlateNumber() + " already exists");
        Vehicle v = Vehicle.builder().plateNumber(req.getPlateNumber()).model(req.getModel())
                .capacity(req.getCapacity() != null ? BigDecimal.valueOf(req.getCapacity()) : null).build();
        return map(vehicleRepository.save(v));
    }

    public List<VehicleResponse> getAllVehicles() { return vehicleRepository.findAll().stream().map(this::map).toList(); }
    public List<VehicleResponse> getAvailable() { return vehicleRepository.findByStatus(VehicleStatus.AVAILABLE).stream().map(this::map).toList(); }
    public VehicleResponse getById(Long id) { return vehicleRepository.findById(id).map(this::map).orElseThrow(() -> new RuntimeException("Vehicle not found")); }

    @Transactional
    public VehicleResponse update(Long id, VehicleRequest req) {
        Vehicle v = vehicleRepository.findById(id).orElseThrow(() -> new RuntimeException("Vehicle not found"));
        v.setPlateNumber(req.getPlateNumber()); v.setModel(req.getModel());
        v.setCapacity(req.getCapacity() != null ? BigDecimal.valueOf(req.getCapacity()) : null);
        return map(vehicleRepository.save(v));
    }

    @Transactional
    public VehicleResponse updateStatus(Long id, Map<String, String> body) {
        Vehicle v = vehicleRepository.findById(id).orElseThrow(() -> new RuntimeException("Vehicle not found"));
        v.setStatus(VehicleStatus.valueOf(body.get("status").toUpperCase()));
        return map(vehicleRepository.save(v));
    }

    private VehicleResponse map(Vehicle v) {
        return VehicleResponse.builder().id(v.getId()).plateNumber(v.getPlateNumber()).model(v.getModel())
                .capacity(v.getCapacity()).status(v.getStatus()).createdAt(v.getCreatedAt()).updatedAt(v.getUpdatedAt()).build();
    }
}
