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

@Service
@RequiredArgsConstructor
public class VehicleService {
    private final VehicleRepository vehicleRepository;

    @Transactional
    public VehicleResponse createVehicle(VehicleRequest req) {
        if (vehicleRepository.existsByPlateNumber(req.getPlateNumber()))
            throw new RuntimeException("Vehicle with plate " + req.getPlateNumber() + " already exists");
        Vehicle v = Vehicle.builder()
                .plateNumber(req.getPlateNumber())
                .model(req.getModel())
                .capacity(req.getCapacity() != null ? BigDecimal.valueOf(req.getCapacity()) : null)
                .build();
        return mapToResponse(vehicleRepository.save(v));
    }

    public List<VehicleResponse> getAllVehicles() {
        return vehicleRepository.findAll().stream().map(this::mapToResponse).toList();
    }

    public List<VehicleResponse> getAvailableVehicles() {
        return vehicleRepository.findByStatus(VehicleStatus.AVAILABLE).stream().map(this::mapToResponse).toList();
    }

    public VehicleResponse getVehicleById(Long id) {
        return vehicleRepository.findById(id).map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Vehicle not found"));
    }

    @Transactional
    public VehicleResponse updateVehicle(Long id, VehicleRequest req) {
        Vehicle v = vehicleRepository.findById(id).orElseThrow(() -> new RuntimeException("Vehicle not found"));
        v.setPlateNumber(req.getPlateNumber());
        v.setModel(req.getModel());
        v.setCapacity(req.getCapacity() != null ? BigDecimal.valueOf(req.getCapacity()) : null);
        return mapToResponse(vehicleRepository.save(v));
    }

    @Transactional
    public VehicleResponse updateStatus(Long id, VehicleStatus status) {
        Vehicle v = vehicleRepository.findById(id).orElseThrow(() -> new RuntimeException("Vehicle not found"));
        v.setStatus(status);
        return mapToResponse(vehicleRepository.save(v));
    }

    private VehicleResponse mapToResponse(Vehicle v) {
        return VehicleResponse.builder()
                .id(v.getId())
                .plateNumber(v.getPlateNumber())
                .model(v.getModel())
                .capacity(v.getCapacity())
                .status(v.getStatus())
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }
}
