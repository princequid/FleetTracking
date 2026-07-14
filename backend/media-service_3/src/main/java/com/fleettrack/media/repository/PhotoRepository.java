package com.fleettrack.media.repository;

import com.fleettrack.media.model.entity.Photo;
import com.fleettrack.media.model.enums.PhotoType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface PhotoRepository extends JpaRepository<Photo, Long> {
    List<Photo> findByTripId(Long tripId);

    boolean existsByTripIdAndPhotoType(Long tripId, PhotoType photoType);

    // Most recent POD photo for a trip — used to check its geotag against the destination.
    Optional<Photo> findFirstByTripIdAndPhotoTypeOrderByUploadedAtDesc(Long tripId, PhotoType photoType);

    // Pushes the "uploaded in the last N days" filter to SQL instead of loading every
    // photo row into memory (used by the nightly integrity check job).
    List<Photo> findByUploadedAtAfter(Instant cutoff);
}
