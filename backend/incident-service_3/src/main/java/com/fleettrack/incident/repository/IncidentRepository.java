package com.fleettrack.incident.repository;

import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByTripId(Long tripId);

    List<Incident> findByStatus(IncidentStatus status);

    List<Incident> findByTripIdAndStatus(Long tripId, IncidentStatus status);
}
