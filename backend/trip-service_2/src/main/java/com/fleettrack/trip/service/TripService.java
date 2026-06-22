package com.fleettrack.trip.service;

import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.client.VehicleServiceClient;
import com.fleettrack.trip.model.dto.*;
import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.enums.TripStatus;
import com.fleettrack.trip.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final DriverServiceClient driverServiceClient;
    private final VehicleServiceClient vehicleServiceClient;

    @Transactional
    public TripResponse createTrip(CreateTripRequest request) {
        DriverResponse driver = driverServiceClient.getDriver(request.getDriverId());
        if (driver == null || !Boolean.TRUE.equals(driver.getIsActive())) {
            throw new RuntimeException("Driver is not active or does not exist");
        }

        VehicleResponse vehicle = vehicleServiceClient.getVehicle(request.getVehicleId());
        if (vehicle == null || !"AVAILABLE".equalsIgnoreCase(vehicle.getStatus())) {
            throw new RuntimeException("Vehicle is not available (status: " +
                    (vehicle != null ? vehicle.getStatus() : "unknown") + ")");
        }

        vehicleServiceClient.updateVehicleStatus(request.getVehicleId(), "IN_USE");

        Trip trip = Trip.builder()
                .driverId(request.getDriverId())
                .vehicleId(request.getVehicleId())
                .origin(request.getOrigin())
                .destination(request.getDestination())
                .originLat(toBigDecimal(request.getOriginLat()))
                .originLng(toBigDecimal(request.getOriginLng()))
                .destLat(toBigDecimal(request.getDestLat()))
                .destLng(toBigDecimal(request.getDestLng()))
                .build();

        return mapToResponse(tripRepository.save(trip));
    }

    public List<TripResponse> getAllTrips(String status) {
        List<Trip> trips;
        if (status != null && !status.isBlank()) {
            trips = tripRepository.findByStatus(TripStatus.valueOf(status.toUpperCase()));
        } else {
            trips = tripRepository.findAll();
        }
        return trips.stream().map(this::mapToResponse).toList();
    }

    public List<TripResponse> getTripsByDriver(Long driverId, String status) {
        List<Trip> trips;
        if (status != null && !status.isBlank()) {
            trips = tripRepository.findByDriverIdAndStatus(driverId, TripStatus.valueOf(status.toUpperCase()));
        } else {
            trips = tripRepository.findByDriverId(driverId);
        }
        return trips.stream().map(this::mapToResponse).toList();
    }

    public TripResponse getTripById(Long id) {
        return tripRepository.findById(id)
                .map(this::mapToResponse)
                .orElseThrow(() -> new RuntimeException("Trip not found"));
    }

    private TripResponse mapToResponse(Trip trip) {
        return TripResponse.builder()
                .id(trip.getId())
                .driverId(trip.getDriverId())
                .vehicleId(trip.getVehicleId())
                .origin(trip.getOrigin())
                .destination(trip.getDestination())
                .originLat(trip.getOriginLat())
                .originLng(trip.getOriginLng())
                .destLat(trip.getDestLat())
                .destLng(trip.getDestLng())
                .status(trip.getStatus())
                .eta(trip.getEta())
                .routeGeometry(trip.getRouteGeometry())
                .createdAt(trip.getCreatedAt())
                .startedAt(trip.getStartedAt())
                .arrivedAt(trip.getArrivedAt())
                .completedAt(trip.getCompletedAt())
                .cancelledAt(trip.getCancelledAt())
                .build();
    }

    private BigDecimal toBigDecimal(Double value) {
        return value != null ? BigDecimal.valueOf(value) : null;
    }
}
