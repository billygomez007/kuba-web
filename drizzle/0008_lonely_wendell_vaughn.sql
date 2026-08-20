ALTER TABLE `leads` ADD `service` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `destination` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `intent` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `notes` text;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `service`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `destination`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `intent`;--> statement-breakpoint
ALTER TABLE `customers` DROP COLUMN `notes`;