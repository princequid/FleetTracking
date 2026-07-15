-- Optional per-stop proof-of-delivery: STOP_POD photos carry the id of the intermediate
-- stop they were captured at. Nullable + additive — existing rows (destination POD,
-- pre-dispatch, etc.) keep stop_id NULL and are unaffected.
ALTER TABLE photos ADD COLUMN IF NOT EXISTS stop_id BIGINT;
