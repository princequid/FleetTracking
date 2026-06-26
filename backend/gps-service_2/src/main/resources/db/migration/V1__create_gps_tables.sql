CREATE TABLE gps_pings (
    id              BIGSERIAL PRIMARY KEY,
    trip_id         BIGINT NOT NULL,
    driver_id       BIGINT NOT NULL,
    lat             DECIMAL(10,7) NOT NULL,
    lng             DECIMAL(10,7) NOT NULL,
    speed_kmh       DECIMAL,
    heading         DECIMAL,
    accuracy_m      DECIMAL,
    recorded_at     TIMESTAMPTZ NOT NULL,
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_offline_ping BOOLEAN NOT NULL DEFAULT false,
    sequence_no     INTEGER,
    validation_flag VARCHAR(30)
);

CREATE INDEX idx_gps_trip_time ON gps_pings(trip_id, recorded_at ASC);
