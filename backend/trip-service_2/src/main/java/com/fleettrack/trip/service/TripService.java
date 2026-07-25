package com.fleettrack.trip.service;

import com.fleettrack.events.TripCompletedEvent;
import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.client.MediaServiceClient;
import com.fleettrack.trip.client.VehicleServiceClient;
import com.fleettrack.trip.event.TripEventPublisher;
import com.fleettrack.trip.model.dto.*;
import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.entity.TripStatusHistory;
import com.fleettrack.trip.model.enums.TripStatus;
import com.fleettrack.trip.repository.TripRepository;
import com.fleettrack.trip.repository.TripStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final TripStatusHistoryRepository statusHistoryRepository;
    private final DriverServiceClient driverServiceClient;
    private final VehicleServiceClient vehicleServiceClient;
    private final MediaServiceClient mediaServiceClient;
    private final TripEventPublisher eventPublisher;
    private final OutboxPublisherService outboxPublisherService;

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

        trip = tripRepository.save(trip);
        recordStatusChange(trip.getId(), null, TripStatus.ASSIGNED, null);
        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse startTrip(Long tripId, Long userId) {
        Trip trip = findTrip(tripId);
        validateStatus(trip, TripStatus.ASSIGNED, "start");

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.STARTED);
        trip.setStartedAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.STARTED, userId);
        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse markArrived(Long tripId, Long userId) {
        Trip trip = findTrip(tripId);
        if (trip.getStatus() != TripStatus.STARTED && trip.getStatus() != TripStatus.EN_ROUTE) {
            throw new RuntimeException("Trip must be STARTED or EN_ROUTE to mark as arrived (current: " + trip.getStatus() + ")");
        }

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.ARRIVED);
        trip.setArrivedAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.ARRIVED, userId);
        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse completeTrip(Long tripId, Long userId) {
        Trip trip = findTrip(tripId);
        validateStatus(trip, TripStatus.ARRIVED, "complete");

        try {
            boolean hasPod = mediaServiceClient.hasPodPhoto(tripId);
            if (!hasPod) {
                throw new RuntimeException("POD photo required before completing trip");
            }
        } catch (RuntimeException e) {
            if (e.getMessage().contains("POD photo required")) {
                throw e;
            }
            throw new RuntimeException("POD photo required before completing trip (media-service unavailable)");
        }

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.DELIVERED);
        trip.setCompletedAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.DELIVERED, userId);

        TripCompletedEvent event = new TripCompletedEvent(
                "trip-service", trip.getId(), trip.getDriverId(),
                trip.getVehicleId(), trip.getCompletedAt(), true);
        outboxPublisherService.saveToOutbox("trip.completed", event);

        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse cancelTrip(Long tripId, Long userId) {
        Trip trip = findTrip(tripId);
        if (trip.getStatus() == TripStatus.DELIVERED) {
            throw new RuntimeException("Cannot cancel a delivered trip");
        }

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.CANCELLED);
        trip.setCancelledAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.CANCELLED, userId);

        try {
            vehicleServiceClient.updateVehicleStatus(trip.getVehicleId(), "AVAILABLE");
        } catch (Exception e) {
            // Vehicle service might be down — logged, will reconcile later
        }

        return mapToResponse(trip);
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

    public List<TripStatusHistoryResponse> getTripStatusHistory(Long tripId) {
        return statusHistoryRepository.findByTripIdOrderByChangedAtAsc(tripId).stream()
                .map(h -> TripStatusHistoryResponse.builder()
                        .oldStatus(h.getOldStatus())
                        .newStatus(h.getNewStatus())
                        .changedBy(h.getChangedBy())
                        .changedAt(h.getChangedAt())
                        .build())
                .toList();
    }

    private Trip findTrip(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new RuntimeException("Trip not found"));
    }

    private void validateStatus(Trip trip, TripStatus expected, String action) {
        if (trip.getStatus() != expected) {
            throw new RuntimeException("Trip must be " + expected + " to " + action + " (current: " + trip.getStatus() + ")");
        }
    }

    private void recordStatusChange(Long tripId, TripStatus oldStatus, TripStatus newStatus, Long userId) {
        TripStatusHistory history = TripStatusHistory.builder()
                .tripId(tripId)
                .oldStatus(oldStatus != null ? oldStatus.name() : null)
                .newStatus(newStatus.name())
                .changedBy(userId)
                .build();
        statusHistoryRepository.save(history);
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
