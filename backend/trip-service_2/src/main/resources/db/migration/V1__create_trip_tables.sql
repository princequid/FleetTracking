CREATE TABLE trips (
    id              BIGSERIAL PRIMARY KEY,
    driver_id       BIGINT NOT NULL,
    vehicle_id      BIGINT NOT NULL,
    origin          VARCHAR(500),
    destination     VARCHAR(500),
    origin_lat      DECIMAL(10,7),
    origin_lng      DECIMAL(10,7),
    dest_lat        DECIMAL(10,7),
    dest_lng        DECIMAL(10,7),
    status          VARCHAR(20) NOT NULL DEFAULT 'ASSIGNED',
    eta             TIMESTAMPTZ,
    route_geometry  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    arrived_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ
);

CREATE INDEX idx_trips_driver_id ON trips(driver_id);
CREATE INDEX idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX idx_trips_status ON trips(status);

CREATE TABLE outbox_events (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,
    payload     JSONB NOT NULL,
    published   BOOLEAN NOT NULL DEFAULT false,
    attempts    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_outbox_events_published ON outbox_events(published) WHERE published = false;
