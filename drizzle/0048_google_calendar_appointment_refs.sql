ALTER TABLE appointments ADD external_provider text;
ALTER TABLE appointments ADD external_event_id text;
ALTER TABLE appointments ADD external_calendar_id text;
CREATE INDEX IF NOT EXISTS appointments_external_event_idx ON appointments(external_provider, external_event_id);
