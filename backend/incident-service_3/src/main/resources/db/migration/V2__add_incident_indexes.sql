-- The incidents table had only its primary key, while IncidentRepository queries
-- exclusively by trip_id, status, or both. Every incident list in the admin portal
-- was therefore a sequential scan that degrades linearly as incidents accumulate.

CREATE INDEX IF NOT EXISTS idx_incidents_trip_id
    ON incident.incidents (trip_id);

CREATE INDEX IF NOT EXISTS idx_incidents_status
    ON incident.incidents (status);

-- Backs findByTripIdAndStatus without needing a bitmap-and of two indexes.
CREATE INDEX IF NOT EXISTS idx_incidents_trip_status
    ON incident.incidents (trip_id, status);

-- The portal lists most-recent-first; this avoids a sort on every page view.
CREATE INDEX IF NOT EXISTS idx_incidents_created_at
    ON incident.incidents (created_at DESC);
