CREATE TABLE `automation_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`automation_id` text NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_data` text,
	`status` text DEFAULT 'running' NOT NULL,
	`error` text,
	`started_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`trigger` text NOT NULL,
	`conditions` text,
	`actions` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
