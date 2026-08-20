CREATE TABLE `platform_manager_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`platform_manager_id` text NOT NULL,
	`business_id` text NOT NULL,
	`created_at` integer NOT NULL
);
