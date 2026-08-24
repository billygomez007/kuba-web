ALTER TABLE `conversations` ADD COLUMN `voice_provider` text;
ALTER TABLE `conversations` ADD COLUMN `voice_direction` text;
ALTER TABLE `conversations` ADD COLUMN `voice_started_at` integer;
ALTER TABLE `conversations` ADD COLUMN `voice_connected_at` integer;
ALTER TABLE `conversations` ADD COLUMN `voice_ended_at` integer;
ALTER TABLE `conversations` ADD COLUMN `voice_duration_seconds` integer;
ALTER TABLE `conversations` ADD COLUMN `voice_billable_minutes` integer;
ALTER TABLE `conversations` ADD COLUMN `voice_recording_url` text;