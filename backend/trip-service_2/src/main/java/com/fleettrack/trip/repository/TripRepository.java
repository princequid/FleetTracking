package com.fleettrack.trip.repository;

import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.enums.TripStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {

    Page<Trip> findByDriverId(Long driverId, Pageable pageable);

    Page<Trip> findByStatus(TripStatus status, Pageable pageable);

    Page<Trip> findByDriverIdAndStatus(Long driverId, TripStatus status, Pageable pageable);
}
