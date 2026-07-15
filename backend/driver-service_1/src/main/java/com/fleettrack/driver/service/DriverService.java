package com.fleettrack.driver.service;

import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.model.entity.DriverProfile;
import com.fleettrack.driver.exception.DriverNotFoundException;
import com.fleettrack.driver.repository.DriverProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

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

    public List<DriverProfileResponse> getAllDrivers(Pageable pageable) {
        return driverProfileRepository.findAll(pageable).getContent().stream()
                .map(this::mapToResponse)
                .toList();
    }

    public List<DriverProfileResponse> getActiveDrivers(Pageable pageable) {
        return driverProfileRepository.findByIsActiveTrue(pageable).stream()
                .map(this::mapToResponse)
                .toList();
    }

    public DriverProfileResponse getDriverById(Long id) {
        return driverProfileRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new DriverNotFoundException("Driver not found"));
    }

    public DriverProfileResponse getDriverByUserId(Long userId) {
        return driverProfileRepository.findByUserId(userId)
                .map(this::mapToResponse)
                .orElseThrow(() -> new DriverNotFoundException("Driver not found for userId " + userId));
    }

    @Transactional
    public DriverProfileResponse updateDriver(Long id, DriverProfileRequest request) {
        DriverProfile profile = driverProfileRepository.findById(id)
                .orElseThrow(() -> new DriverNotFoundException("Driver not found"));
        profile.setFullName(request.getFullName());
        profile.setPhone(request.getPhone());
        profile.setLicenceNo(request.getLicenceNo());
        return mapToResponse(driverProfileRepository.save(profile));
    }

    @Transactional
    public DriverProfileResponse deactivateDriver(Long id) {
        DriverProfile profile = driverProfileRepository.findById(id)
                .orElseThrow(() -> new DriverNotFoundException("Driver not found"));
        profile.setIsActive(false);
        return mapToResponse(driverProfileRepository.save(profile));
    }

    public DriverStatsResponse getDriverStats(Long id) {
        // Confirm the driver exists (404 if not) before reporting on its stats.
        if (!driverProfileRepository.existsById(id)) {
            throw new DriverNotFoundException("Driver not found");
        }
        // NOTE: real stats require cross-service data (completed/on-time trips from
        // trip-service, incident counts from incident-service). driver-service has no
        // client wired up to either service yet (DriverStatsService is an empty stub and
        // there is no trip-service/incident-service client in this service), so we
        // deliberately do not fabricate numbers here. Wire this up for real once such a
        // client exists, rather than resurrecting hardcoded zeros.
        throw new ResponseStatusException(HttpStatus.NOT_IMPLEMENTED, "Driver stats not yet available");
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
