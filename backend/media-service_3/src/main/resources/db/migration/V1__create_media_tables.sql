CREATE TABLE IF NOT EXISTS photos (
    id BIGSERIAL PRIMARY KEY,
    trip_id BIGINT NOT NULL,
    driver_id BIGINT NOT NULL,
    photo_key VARCHAR(500),
    photo_url TEXT,
    photo_type VARCHAR(20) NOT NULL,
    mime_type VARCHAR(50),
    file_size_bytes BIGINT,
    lat DECIMAL(10,7),
    lng DECIMAL(10,7),
    taken_at TIMESTAMPTZ,
    sha256_hash VARCHAR(64),
    is_tamper_evident BOOLEAN DEFAULT true,
    deleted_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT now()
);
