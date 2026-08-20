ALTER TABLE `integrations` ADD `public_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_public_key_unique` ON `integrations` (`public_key`);