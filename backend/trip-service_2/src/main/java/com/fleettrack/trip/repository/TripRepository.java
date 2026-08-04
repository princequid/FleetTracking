package com.fleettrack.trip.repository;

import com.fleettrack.trip.model.entity.Trip;
import com.fleettrack.trip.model.enums.TripStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Collection;
import java.util.Set;

@Repository
public interface TripRepository extends JpaRepository<Trip, Long> {

    Page<Trip> findByDriverId(Long driverId, Pageable pageable);

    Page<Trip> findByStatus(TripStatus status, Pageable pageable);

    Page<Trip> findByDriverIdAndStatus(Long driverId, TripStatus status, Pageable pageable);

    long countByDriverIdAndStatus(Long driverId, TripStatus status);

    // "On time" = delivered at or before the ETA that was in effect for the trip. A trip
    // with no ETA ever set can't be judged either way, so it's excluded from the
    // numerator (comparing against a null eta evaluates to unknown/false in JPQL, same as
    // SQL) — it still counts toward the denominator via countByDriverIdAndStatus above.
    @Query("SELECT COUNT(t) FROM Trip t WHERE t.driverId = :driverId AND t.status = 'DELIVERED' "
            + "AND t.eta IS NOT NULL AND t.completedAt <= t.eta")
    long countOnTimeByDriverId(@Param("driverId") Long driverId);

    /**
     * Vehicles currently held by a trip that hasn't finished.
     *
     * Selects only the id column — the reconciliation sweep needs a set of ids, not
     * hydrated entities, and loading every active Trip to read one field each would
     * be wasteful on a service with a 5-connection pool.
     */
    @Query("SELECT DISTINCT t.vehicleId FROM Trip t "
            + "WHERE t.status IN :statuses AND t.vehicleId IS NOT NULL")
    Set<Long> findActiveVehicleIds(@Param("statuses") Collection<TripStatus> statuses);

    /**
     * Vehicles whose trip finished recently, as reconciliation candidates.
     *
     * Time-bounded on purpose: without the cutoff this would return every vehicle
     * ever used and re-issue a status call for each one on every sweep.
     */
    @Query("SELECT DISTINCT t.vehicleId FROM Trip t "
            + "WHERE t.vehicleId IS NOT NULL "
            + "AND ((t.status = 'DELIVERED' AND t.completedAt >= :since) "
            + "  OR (t.status = 'CANCELLED' AND t.cancelledAt >= :since))")
    Set<Long> findRecentlyEndedVehicleIds(@Param("since") Instant since);
}
