CREATE TABLE `ai_employee_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`role_instructions` text,
	`goals` text,
	`responsibilities` text,
	`personality` text,
	`communication_style` text,
	`information_to_collect` text,
	`escalation_rules` text,
	`handoff_rules` text,
	`working_hours` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_employee_settings_employee_id_unique` ON `ai_employee_settings` (`employee_id`);