CREATE TABLE `ai_employee_action_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`action` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ai_employee_action_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`autonomy_level` text DEFAULT 'operator' NOT NULL,
	`policy` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_employee_action_policies_employee_id_unique` ON `ai_employee_action_policies` (`employee_id`);