package com.fleettrack.incident.repository;

import com.fleettrack.incident.model.entity.Incident;
import com.fleettrack.incident.model.enums.IncidentSeverity;
import com.fleettrack.incident.model.enums.IncidentStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IncidentRepository extends JpaRepository<Incident, Long> {
    List<Incident> findByTripId(Long tripId);

    List<Incident> findBySeverity(IncidentSeverity severity);

    List<Incident> findByStatus(IncidentStatus status);
}
