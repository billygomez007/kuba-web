CREATE TABLE `customer_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`tag` text NOT NULL,
	`created_at` integer NOT NULL
);
