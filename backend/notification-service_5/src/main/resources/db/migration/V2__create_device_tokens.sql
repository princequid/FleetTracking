CREATE TABLE device_tokens (
    id            BIGSERIAL PRIMARY KEY,
    recipient_id  BIGINT NOT NULL,
    token         VARCHAR(512) NOT NULL UNIQUE,
    platform      VARCHAR(16),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_recipient ON device_tokens(recipient_id);
