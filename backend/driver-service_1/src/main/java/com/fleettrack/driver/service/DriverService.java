package com.fleettrack.driver.service;

import com.fleettrack.driver.client.TripServiceClient;
import com.fleettrack.driver.model.dto.DriverProfileRequest;
import com.fleettrack.driver.model.dto.DriverProfileResponse;
import com.fleettrack.driver.model.dto.DriverStatsResponse;
import com.fleettrack.driver.model.dto.TripStatsResponse;
import com.fleettrack.driver.model.entity.DriverProfile;
import com.fleettrack.driver.exception.DriverNotFoundException;
import com.fleettrack.driver.repository.DriverProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class DriverService {

    private final DriverProfileRepository driverProfileRepository;
    private final TripServiceClient tripServiceClient;

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
        // Completed/on-time trip counts live in trip-service, not here — pulled via a
        // trusted internal call (see TripServiceClient). If trip-service is unreachable,
        // the client itself falls back to zeroed stats rather than failing this request.
        TripStatsResponse tripStats = tripServiceClient.getDriverTripStats(id);
        long total = tripStats.getCompletedTrips();
        long onTime = tripStats.getOnTimeTrips();
        // null (not 0%) when there's no completed trip yet — "no data" and "0% on-time
        // over real trips" mean different things and the UI shouldn't conflate them.
        Integer onTimePercent = total > 0 ? (int) Math.round((onTime * 100.0) / total) : null;
        // Rating has no independent source of its own (no customer feedback, no admin
        // rating UI) — by product decision it's derived from on-time %, linearly mapped
        // onto the familiar 1-5 star scale (0% -> 1.0, 100% -> 5.0). Null follows
        // onTimePercent for the same "no data yet" reason.
        Double rating = onTimePercent != null
                ? Math.round((1 + (onTimePercent / 100.0) * 4) * 10) / 10.0
                : null;

        return DriverStatsResponse.builder()
                .driverId(id)
                .totalTrips((int) total)
                .onTimeTrips((int) onTime)
                .onTimePercent(onTimePercent)
                .rating(rating)
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
