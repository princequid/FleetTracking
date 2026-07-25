package com.fleettrack.audit.repository;

import com.fleettrack.audit.model.entity.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findByEventType(String eventType);
    List<AuditLog> findByServiceName(String serviceName);
    List<AuditLog> findByOccurredAtBetween(Instant from, Instant to);
}
