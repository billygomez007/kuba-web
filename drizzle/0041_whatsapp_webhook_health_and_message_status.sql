ALTER TABLE `integrations` ADD `last_webhook_at` integer;--> statement-breakpoint
ALTER TABLE `messages` ADD `status` text;--> statement-breakpoint
ALTER TABLE `messages` ADD `status_updated_at` integer;