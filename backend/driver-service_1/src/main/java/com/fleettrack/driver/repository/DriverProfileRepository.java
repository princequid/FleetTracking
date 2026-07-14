package com.fleettrack.driver.repository;

import com.fleettrack.driver.model.entity.DriverProfile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DriverProfileRepository extends JpaRepository<DriverProfile, Long> {

    Optional<DriverProfile> findByUserId(Long userId);

    List<DriverProfile> findByIsActiveTrue(Pageable pageable);

    boolean existsByUserId(Long userId);
}
