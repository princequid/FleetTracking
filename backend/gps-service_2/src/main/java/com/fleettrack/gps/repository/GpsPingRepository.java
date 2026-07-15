package com.fleettrack.gps.repository;

import com.fleettrack.gps.model.entity.GpsPing;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface GpsPingRepository extends JpaRepository<GpsPing, Long> {

    // Most-recent-first + Pageable so callers (GpsService.getRoute) can cap the result
    // instead of pulling a trip's entire, unbounded ping history.
    Page<GpsPing> findByTripIdOrderByRecordedAtDesc(Long tripId, Pageable pageable);

    Optional<GpsPing> findFirstByTripIdOrderByRecordedAtDesc(Long tripId);

    Optional<GpsPing> findFirstByTripIdAndRecordedAtBeforeOrderByRecordedAtDesc(Long tripId, Instant recordedAt);
}
