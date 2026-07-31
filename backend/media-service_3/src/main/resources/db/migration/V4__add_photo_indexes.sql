-- The photos table had no index other than its primary key, yet every query
-- filters on trip_id and/or photo_type. The worst case is on the critical path of
-- trip completion: MediaController.getTripPhotoStatus -> existsByTripIdAndPhotoType
-- is called synchronously by trip-service before a driver can complete a delivery,
-- so that sequential scan grows with the whole photo table and eventually times out
-- the completion request itself.

CREATE INDEX IF NOT EXISTS idx_photos_trip_type
    ON photos (trip_id, photo_type);

-- Backs findFirstByTripIdAndPhotoTypeOrderByUploadedAtDesc without a sort step.
CREATE INDEX IF NOT EXISTS idx_photos_trip_type_uploaded
    ON photos (trip_id, photo_type, uploaded_at DESC);

-- Backs the nightly IntegrityCheckJob's findByUploadedAtAfter, which otherwise
-- scans the entire table every night.
CREATE INDEX IF NOT EXISTS idx_photos_uploaded_at
    ON photos (uploaded_at);
