package com.fleettrack.trip.service;

import com.fleettrack.events.TripAssignedEvent;
import com.fleettrack.events.TripCancelledEvent;
import com.fleettrack.events.TripCompletedEvent;
import com.fleettrack.events.TripStartedEvent;
import com.fleettrack.trip.client.DriverServiceClient;
import com.fleettrack.trip.client.MediaServiceClient;
import com.fleettrack.trip.client.VehicleServiceClient;
import com.fleettrack.trip.event.TripEventPublisher;
import com.fleettrack.trip.exception.TripNotFoundException;
import com.fleettrack.trip.model.dto.*;
import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.entity.TripStop;
import com.fleettrack.trip.model.entity.TripStatusHistory;
import com.fleettrack.trip.model.enums.TripStatus;
import com.fleettrack.trip.repository.TripRepository;
import com.fleettrack.trip.repository.TripStatusHistoryRepository;
import com.fleettrack.trip.repository.TripStopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TripService {

    private final TripRepository tripRepository;
    private final TripStatusHistoryRepository statusHistoryRepository;
    private final TripStopRepository tripStopRepository;
    private final DriverServiceClient driverServiceClient;
    private final VehicleServiceClient vehicleServiceClient;
    private final MediaServiceClient mediaServiceClient;
    private final TripEventPublisher eventPublisher;
    private final OutboxPublisherService outboxPublisherService;
    private final EtaService etaService;

    // Geofence radius for start/arrive/POD proximity checks.
    private static final double GEOFENCE_RADIUS_METERS = 50.0;
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

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

        BigDecimal originLat = toBigDecimal(request.getOriginLat());
        BigDecimal originLng = toBigDecimal(request.getOriginLng());
        BigDecimal destLat   = toBigDecimal(request.getDestLat());
        BigDecimal destLng   = toBigDecimal(request.getDestLng());

        // Calculate ETA via OSRM (best-effort — null if server unreachable or coords missing)
        Instant eta = etaService.calculateEta(originLat, originLng, request.getStops(), destLat, destLng)
                .orElse(null);

        Trip trip = Trip.builder()
                .driverId(request.getDriverId())
                .vehicleId(request.getVehicleId())
                .origin(request.getOrigin())
                .destination(request.getDestination())
                .description(request.getDescription())
                .originLat(originLat)
                .originLng(originLng)
                .destLat(destLat)
                .destLng(destLng)
                .eta(eta)
                .build();

        trip = tripRepository.save(trip);

        // Persist stops in order
        List<StopRequest> rawStops = request.getStops();
        if (rawStops != null && !rawStops.isEmpty()) {
            final Long tripId = trip.getId();
            for (int i = 0; i < rawStops.size(); i++) {
                StopRequest s = rawStops.get(i);
                if (s.getName() != null && !s.getName().isBlank()) {
                    tripStopRepository.save(TripStop.builder()
                            .tripId(tripId)
                            .stopOrder(i + 1)
                            .locationName(s.getName())
                            .description(s.getDescription())
                            .lat(s.getLat() != null ? BigDecimal.valueOf(s.getLat()) : null)
                            .lng(s.getLng() != null ? BigDecimal.valueOf(s.getLng()) : null)
                            .build());
                }
            }
        }

        recordStatusChange(trip.getId(), null, TripStatus.ASSIGNED, null);

        // Notify the driver that a new trip was assigned (drives the mobile notifications page)
        TripAssignedEvent assignedEvent = new TripAssignedEvent(
                "trip-service", trip.getId(), trip.getDriverId(), trip.getVehicleId(),
                trip.getOrigin(), trip.getDestination(), trip.getEta());
        outboxPublisherService.saveToOutbox("trip.assigned", assignedEvent);

        // Mark the vehicle IN_USE only AFTER the DB transaction commits. Doing this call
        // before persisting (the old behavior) meant a DB failure would roll back the trip
        // while the vehicle-service call had already gone through and stayed IN_USE with no
        // trip to show for it. Deferring to afterCommit keeps the blocking network call out
        // of the transaction and avoids that partial-failure state.
        Long tripIdForCallback = trip.getId();
        Long vehicleIdForCallback = request.getVehicleId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        vehicleServiceClient.updateVehicleStatus(vehicleIdForCallback, "IN_USE");
                    } catch (Exception e) {
                        log.error("Trip {} committed but failed to mark vehicle {} IN_USE — " +
                                "vehicle status may be stale and require manual reconciliation",
                                tripIdForCallback, vehicleIdForCallback, e);
                    }
                }
            });
        } else {
            // Should not happen (method is @Transactional), but never silently skip the call.
            try {
                vehicleServiceClient.updateVehicleStatus(vehicleIdForCallback, "IN_USE");
            } catch (Exception e) {
                log.error("Trip {} created but failed to mark vehicle {} IN_USE",
                        tripIdForCallback, vehicleIdForCallback, e);
            }
        }

        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse startTrip(Long tripId, Long userId, LocationRequest location, Long requesterDriverId) {
        Trip trip = findTrip(tripId);
        checkOwnership(trip, requesterDriverId);
        validateStatus(trip, TripStatus.ASSIGNED, "start");
        requireWithinGeofence(location, trip.getOriginLat(), trip.getOriginLng(), "pickup location");

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.STARTED);
        trip.setStartedAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.STARTED, userId);

        // Notify the driver the trip is now started
        TripStartedEvent startedEvent = new TripStartedEvent(
                "trip-service", trip.getId(), trip.getDriverId(), trip.getVehicleId(),
                trip.getOrigin(), trip.getDestination());
        outboxPublisherService.saveToOutbox("trip.started", startedEvent);

        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse markArrived(Long tripId, Long userId, LocationRequest location, Long requesterDriverId) {
        Trip trip = findTrip(tripId);
        checkOwnership(trip, requesterDriverId);
        if (trip.getStatus() != TripStatus.STARTED && trip.getStatus() != TripStatus.EN_ROUTE) {
            throw new RuntimeException("Trip must be STARTED or EN_ROUTE to mark as arrived (current: " + trip.getStatus() + ")");
        }
        requireWithinGeofence(location, trip.getDestLat(), trip.getDestLng(), "destination");

        TripStatus oldStatus = trip.getStatus();
        trip.setStatus(TripStatus.ARRIVED);
        trip.setArrivedAt(Instant.now());
        trip = tripRepository.save(trip);

        recordStatusChange(tripId, oldStatus, TripStatus.ARRIVED, userId);
        return mapToResponse(trip);
    }

    @Transactional
    public TripResponse completeTrip(Long tripId, Long userId, Long requesterDriverId) {
        Trip trip = findTrip(tripId);
        checkOwnership(trip, requesterDriverId);
        validateStatus(trip, TripStatus.ARRIVED, "complete");

        MediaPodStatusResponse podStatus;
        try {
            podStatus = mediaServiceClient.getPodStatus(tripId);
        } catch (Exception e) {
            throw new RuntimeException("POD photo required before completing trip (media-service unavailable)");
        }

        if (!Boolean.TRUE.equals(podStatus.getHasPOD())) {
            throw new RuntimeException("POD photo required before completing trip");
        }

        // Verify the POD photo's OWN geotag was actually captured near the destination —
        // closes the gap where a photo taken from anywhere would satisfy "has POD".
        // Skipped if either coordinate is missing (legacy photo predating this check, or
        // the trip's destination was never geocoded) — nothing to validate against.
        if (podStatus.getLat() != null && podStatus.getLng() != null
                && trip.getDestLat() != null && trip.getDestLng() != null) {
            double distance = haversineMetres(
                    podStatus.getLat(), podStatus.getLng(),
                    trip.getDestLat().doubleValue(), trip.getDestLng().doubleValue());
            if (distance > GEOFENCE_RADIUS_METERS) {
                throw new RuntimeException(String.format(
                        "The POD photo was taken %.0fm from the destination — you must be within %.0fm to complete this trip.",
                        distance, GEOFENCE_RADIUS_METERS));
            }
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

        // Notify the driver that their trip was cancelled
        TripCancelledEvent cancelledEvent = new TripCancelledEvent(
                "trip-service", trip.getId(), trip.getDriverId(), trip.getVehicleId(),
                trip.getOrigin(), trip.getDestination());
        outboxPublisherService.saveToOutbox("trip.cancelled", cancelledEvent);

        try {
            vehicleServiceClient.updateVehicleStatus(trip.getVehicleId(), "AVAILABLE");
        } catch (Exception e) {
            // Vehicle service might be down — logged, will reconcile later
            log.warn("Trip {} cancelled but failed to mark vehicle {} AVAILABLE — " +
                    "vehicle status may be stale and require manual reconciliation",
                    trip.getId(), trip.getVehicleId(), e);
        }

        return mapToResponse(trip);
    }

    public List<TripResponse> getAllTrips(String status, Pageable pageable) {
        Page<Trip> trips;
        if (status != null && !status.isBlank()) {
            trips = tripRepository.findByStatus(parseStatus(status), pageable);
        } else {
            trips = tripRepository.findAll(pageable);
        }
        return mapTripsWithStops(trips.getContent());
    }

    public List<TripResponse> getTripsByDriver(Long driverId, String status, Pageable pageable) {
        Page<Trip> trips;
        if (status != null && !status.isBlank()) {
            trips = tripRepository.findByDriverIdAndStatus(driverId, parseStatus(status), pageable);
        } else {
            trips = tripRepository.findByDriverId(driverId, pageable);
        }
        return mapTripsWithStops(trips.getContent());
    }

    public TripResponse getTripById(Long id, Long requesterDriverId) {
        Trip trip = findTrip(id);
        checkOwnership(trip, requesterDriverId);
        return mapToResponse(trip);
    }

    public List<TripStatusHistoryResponse> getTripStatusHistory(Long tripId, Long requesterDriverId) {
        Trip trip = findTrip(tripId);
        checkOwnership(trip, requesterDriverId);
        return statusHistoryRepository.findByTripIdOrderByChangedAtAsc(tripId).stream()
                .map(h -> TripStatusHistoryResponse.builder()
                        .oldStatus(h.getOldStatus())
                        .newStatus(h.getNewStatus())
                        .changedBy(h.getChangedBy())
                        .changedAt(h.getChangedAt())
                        .build())
                .toList();
    }

    // Stores the road-following route geometry the driver app pushed (on trip start and
    // on each reroute). Ownership-checked so a driver can only set their own trip's route.
    @Transactional
    public void updateRoute(Long tripId, String routeGeometry, Long requesterDriverId) {
        Trip trip = findTrip(tripId);
        checkOwnership(trip, requesterDriverId);
        trip.setRouteGeometry(routeGeometry);
        tripRepository.save(trip);
    }

    private Trip findTrip(Long tripId) {
        return tripRepository.findById(tripId)
                .orElseThrow(() -> new TripNotFoundException("Trip not found: " + tripId));
    }

    // Enforces trip ownership for DRIVER callers. requesterDriverId is null for
    // non-driver (admin/dispatcher) callers and internal-service calls — those are not
    // restricted here since role/internal-key checks already happened in the controller.
    private void checkOwnership(Trip trip, Long requesterDriverId) {
        if (requesterDriverId != null && !requesterDriverId.equals(trip.getDriverId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have access to this trip");
        }
    }

    private TripStatus parseStatus(String status) {
        try {
            return TripStatus.valueOf(status.toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }

    private void validateStatus(Trip trip, TripStatus expected, String action) {
        if (trip.getStatus() != expected) {
            throw new RuntimeException("Trip must be " + expected + " to " + action + " (current: " + trip.getStatus() + ")");
        }
    }

    // Rejects the action unless the supplied location is within GEOFENCE_RADIUS_METERS of
    // the given target coordinates. Fails CLOSED: missing driver location is always
    // rejected. If the trip itself has no stored coordinates for the target (e.g. it was
    // dispatched with only a typed address, never geocoded), there is nothing to check
    // against — that's a dispatch data gap, not a driver location violation, so the check
    // is skipped rather than blocking the driver for something outside their control.
    private void requireWithinGeofence(LocationRequest location, BigDecimal targetLat, BigDecimal targetLng, String placeLabel) {
        if (targetLat == null || targetLng == null) return;

        if (location == null || location.getLat() == null || location.getLng() == null) {
            throw new RuntimeException("Location is required — enable location services and try again.");
        }

        double distance = haversineMetres(
                location.getLat(), location.getLng(),
                targetLat.doubleValue(), targetLng.doubleValue());

        if (distance > GEOFENCE_RADIUS_METERS) {
            throw new RuntimeException(String.format(
                    "You must be within %.0fm of the %s to do this (currently %.0fm away).",
                    GEOFENCE_RADIUS_METERS, placeLabel, distance));
        }
    }

    private static double haversineMetres(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
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

    // Single-trip mapping (createTrip, getTripById, transitions) — one stop query.
    private TripResponse mapToResponse(Trip trip) {
        return buildResponse(trip, tripStopRepository.findByTripIdOrderByStopOrder(trip.getId()));
    }

    // List mapping — fetches ALL stops for the trips in ONE query, then groups them
    // in memory. Avoids the N+1 (one stop query per trip) on /trips.
    private List<TripResponse> mapTripsWithStops(List<Trip> trips) {
        if (trips.isEmpty()) return List.of();
        List<Long> ids = trips.stream().map(Trip::getId).toList();
        Map<Long, List<TripStop>> stopsByTrip = tripStopRepository
                .findByTripIdInOrderByTripIdAscStopOrderAsc(ids)
                .stream()
                .collect(Collectors.groupingBy(TripStop::getTripId));
        return trips.stream()
                .map(t -> buildResponse(t, stopsByTrip.getOrDefault(t.getId(), List.of())))
                .toList();
    }

    private TripResponse buildResponse(Trip trip, List<TripStop> tripStops) {
        List<TripStopResponse> stops = tripStops.stream()
                .map(s -> TripStopResponse.builder()
                        .id(s.getId())
                        .stopOrder(s.getStopOrder())
                        .name(s.getLocationName())
                        .description(s.getDescription())
                        .lat(s.getLat())
                        .lng(s.getLng())
                        .build())
                .toList();

        return TripResponse.builder()
                .id(trip.getId())
                .driverId(trip.getDriverId())
                .vehicleId(trip.getVehicleId())
                .origin(trip.getOrigin())
                .destination(trip.getDestination())
                .description(trip.getDescription())
                .originLat(trip.getOriginLat())
                .originLng(trip.getOriginLng())
                .destLat(trip.getDestLat())
                .destLng(trip.getDestLng())
                .stops(stops.isEmpty() ? Collections.emptyList() : stops)
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
