CREATE SCHEMA IF NOT EXISTS incident;

CREATE TABLE IF NOT EXISTS incident.incidents (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL,
    driver_id BIGINT NOT NULL,
    incident_type VARCHAR(30) NOT NULL CHECK (incident_type IN ('CARGO_DAMAGE','MISSING_ITEM','ACCIDENT','VEHICLE_BREAKDOWN','REFUSED_DELIVERY','OTHER')),
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','UNDER_REVIEW','RESOLVED','DISMISSED')),
    reviewed_by BIGINT,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
