package com.fleettrack.gps.repository;

import com.fleettrack.gps.model.entity.GpsPing;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface GpsPingRepository extends JpaRepository<GpsPing, Long> {

    List<GpsPing> findByTripIdOrderByRecordedAtAsc(Long tripId);

    Optional<GpsPing> findFirstByTripIdOrderByRecordedAtDesc(Long tripId);
}
