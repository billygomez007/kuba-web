CREATE TABLE `ai_employee_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`version` text DEFAULT '1.0' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`location` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`from_employee_id` text,
	`to_user_id` text,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `ai_employees` ADD `branch_id` text;--> statement-breakpoint
ALTER TABLE `ai_employees` ADD `supervision_mode` text DEFAULT 'owner_supervised' NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_employees` ADD `supervisor_user_id` text;--> statement-breakpoint
ALTER TABLE `business_users` ADD `branch_id` text;