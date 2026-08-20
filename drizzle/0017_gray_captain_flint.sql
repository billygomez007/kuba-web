CREATE TABLE `business_localization` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`country` text,
	`currency` text,
	`currency_code` text,
	`language` text DEFAULT 'en',
	`timezone` text DEFAULT 'Africa/Accra',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `business_localization_business_id_unique` ON `business_localization` (`business_id`);