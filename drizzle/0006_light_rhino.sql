CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`source` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `conversations` ADD `customer_id` text;--> statement-breakpoint
ALTER TABLE `leads` ADD `customer_id` text;