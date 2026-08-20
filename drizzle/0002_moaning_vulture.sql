CREATE TABLE `sales_activities` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`lead_id` text NOT NULL,
	`employee_id` text,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL
);
