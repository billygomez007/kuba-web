CREATE TABLE `ai_business_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`business_description` text,
	`products_and_services` text,
	`target_customers` text,
	`frequently_asked_questions` text,
	`ai_instructions` text,
	`tone` text DEFAULT 'professional',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_business_settings_business_id_unique` ON `ai_business_settings` (`business_id`);