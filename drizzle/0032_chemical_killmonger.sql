ALTER TABLE `skills` ADD `publisher` text DEFAULT 'Kuba' NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `icon` text;--> statement-breakpoint
ALTER TABLE `skills` ADD `is_marketplace` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `price` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `rating` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `skills` ADD `install_count` integer DEFAULT 0 NOT NULL;