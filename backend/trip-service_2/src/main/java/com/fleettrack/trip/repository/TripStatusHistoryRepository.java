package com.fleettrack.trip.repository;

import com.fleettrack.trip.model.entity.TripStatusHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripStatusHistoryRepository extends JpaRepository<TripStatusHistory, Long> {

    List<TripStatusHistory> findByTripIdOrderByChangedAtAsc(Long tripId);
}
