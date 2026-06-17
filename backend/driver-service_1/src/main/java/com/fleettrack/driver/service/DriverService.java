package com.fleettrack.driver.service;

import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.model.entity.DriverProfile;
import com.fleettrack.driver.repository.DriverProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {

    private final DriverProfileRepository driverProfileRepository;

    @Transactional
    public DriverProfileResponse createDriver(DriverProfileRequest request) {
        if (driverProfileRepository.existsByUserId(request.getUserId())) {
            throw new RuntimeException("Driver profile already exists for userId " + request.getUserId());
        }
        DriverProfile profile = DriverProfile.builder()
                .userId(request.getUserId())
                .fullName(request.getFullName())
                .phone(request.getPhone())
                .licenceNo(request.getLicenceNo())
                .build();
        return mapToResponse(driverProfileRepository.save(profile));
    }

    public List<DriverProfileResponse> getAllDrivers() {
        return driverProfileRepository.findAll().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public List<DriverProfileResponse> getActiveDrivers() {
        return driverProfileRepository.findByIsActiveTrue().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public DriverProfileResponse getDriverById(Long id) {
        return driverProfileRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Driver not found"));
    }

    public DriverProfileResponse getDriverByUserId(Long userId) {
        return driverProfileRepository.findByUserId(userId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Driver not found for userId " + userId));
    }

    @Transactional
    public DriverProfileResponse updateDriver(Long id, DriverProfileRequest request) {
        DriverProfile profile = driverProfileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Driver not found"));
        profile.setFullName(request.getFullName());
        profile.setPhone(request.getPhone());
        profile.setLicenceNo(request.getLicenceNo());
        return mapToResponse(driverProfileRepository.save(profile));
    }

    @Transactional
    public DriverProfileResponse deactivateDriver(Long id) {
        DriverProfile profile = driverProfileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Driver not found"));
        profile.setIsActive(false);
        return mapToResponse(driverProfileRepository.save(profile));
    }

    public DriverStatsResponse getDriverStats(Long id) {
        DriverProfile profile = driverProfileRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Driver not found"));
        return DriverStatsResponse.builder()
                .driverId(profile.getId())
                .fullName(profile.getFullName())
                .totalTrips(0)
                .onTimeTrips(0)
                .incidentCount(0)
                .performanceScore(0.0)
                .build();
    }

    private DriverProfileResponse mapToResponse(DriverProfile profile) {
        return DriverProfileResponse.builder()
                .id(profile.getId())
                .userId(profile.getUserId())
                .fullName(profile.getFullName())
                .phone(profile.getPhone())
                .licenceNo(profile.getLicenceNo())
                .isActive(profile.getIsActive())
                .createdAt(profile.getCreatedAt())
                .updatedAt(profile.getUpdatedAt())
                .build();
    }
}
