CREATE TABLE `ai_employee_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'completed' NOT NULL,
	`created_at` integer NOT NULL
);
