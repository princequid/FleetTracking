package com.fleettrack.auth.repository;

import com.fleettrack.auth.model.entity.ProcessedEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface ProcessedEventRepository extends JpaRepository<ProcessedEvent, UUID> {
    boolean existsByEventId(UUID eventId);
}
