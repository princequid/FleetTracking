CREATE TABLE trip_stops (
    id             BIGSERIAL PRIMARY KEY,
    trip_id        BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    stop_order     INTEGER NOT NULL,
    location_name  VARCHAR(500),
    lat            DECIMAL(10,7),
    lng            DECIMAL(10,7)
);

CREATE INDEX idx_trip_stops_trip_id ON trip_stops(trip_id);
