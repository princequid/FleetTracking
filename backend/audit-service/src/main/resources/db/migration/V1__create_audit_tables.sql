CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    event_type      VARCHAR(50),
    actor_user_id   BIGINT,
    actor_role      VARCHAR(20),
    target_type     VARCHAR(30),
    target_id       BIGINT,
    old_value       JSONB,
    new_value       JSONB,
    ip_address      VARCHAR(45),
    service_name    VARCHAR(50),
    occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_occurred ON audit_logs(occurred_at DESC);
