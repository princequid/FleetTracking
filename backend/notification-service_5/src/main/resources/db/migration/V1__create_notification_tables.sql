CREATE TABLE notifications (
    id            BIGSERIAL PRIMARY KEY,
    recipient_id  BIGINT NOT NULL,
    type          VARCHAR(30) NOT NULL,
    title         VARCHAR(200) NOT NULL,
    message       VARCHAR(500),
    trip_id       BIGINT,
    is_read       BOOLEAN NOT NULL DEFAULT false,
    event_id      UUID,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(recipient_id) WHERE is_read = false;

-- Deduplicate notifications created from the same domain event (redelivery-safe)
CREATE UNIQUE INDEX uq_notifications_event ON notifications(event_id) WHERE event_id IS NOT NULL;
