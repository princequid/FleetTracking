package com.fleettrack.trip.repository;

import com.fleettrack.trip.model.entity.TripStop;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TripStopRepository extends JpaRepository<TripStop, Long> {
    List<TripStop> findByTripIdOrderByStopOrder(Long tripId);
}
