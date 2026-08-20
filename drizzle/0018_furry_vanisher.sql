ALTER TABLE `leads` ADD `estimated_value` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `currency` text DEFAULT 'GHS';--> statement-breakpoint
ALTER TABLE `leads` ADD `deal_status` text DEFAULT 'open';--> statement-breakpoint
ALTER TABLE `leads` ADD `closed_at` integer;