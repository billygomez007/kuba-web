CREATE TABLE `ai_employee_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_employee_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `business_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`business_user_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `business_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`department` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conversation_routing` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`department` text NOT NULL,
	`team_id` text,
	`ai_employee_id` text,
	`assigned_user_id` text,
	`assignment_type` text DEFAULT 'ai' NOT NULL,
	`status` text DEFAULT 'ai_handling' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`confidence` integer DEFAULT 0 NOT NULL,
	`routing_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employee_skills` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`installed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`skill_id`) REFERENCES `skills`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `employeeSkills_employeeId_idx` ON `employee_skills` (`employee_id`);--> statement-breakpoint
CREATE INDEX `employeeSkills_skillId_idx` ON `employee_skills` (`skill_id`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`type` text DEFAULT 'kuba_official' NOT NULL,
	`version` text DEFAULT '1.0' NOT NULL,
	`instructions` text,
	`tools` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_slug_unique` ON `skills` (`slug`);