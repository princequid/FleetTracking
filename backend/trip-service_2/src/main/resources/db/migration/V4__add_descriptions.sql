-- Optional free-text descriptions/notes the dispatcher can attach
ALTER TABLE trips      ADD COLUMN description VARCHAR(1000);
ALTER TABLE trip_stops ADD COLUMN description VARCHAR(500);
