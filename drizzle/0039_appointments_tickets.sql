CREATE TABLE `appointments` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`customer_id` text,
	`lead_id` text,
	`conversation_id` text,
	`branch_id` text,
	`assigned_user_id` text,
	`assigned_human_employee_id` text,
	`assigned_ai_employee_id` text,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`timezone` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`appointment_type` text DEFAULT 'meeting' NOT NULL,
	`meeting_mode` text DEFAULT 'in_person' NOT NULL,
	`location` text,
	`meeting_url` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`confirmed_at` integer,
	`completed_at` integer,
	`cancelled_at` integer,
	`no_show_at` integer,
	`cancellation_reason` text
);
--> statement-breakpoint
CREATE INDEX `appointments_business_start_idx` ON `appointments` (`business_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_business_status_start_idx` ON `appointments` (`business_id`,`status`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_business_customer_idx` ON `appointments` (`business_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `appointments_business_assigned_user_idx` ON `appointments` (`business_id`,`assigned_user_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `appointments_business_assigned_ai_idx` ON `appointments` (`business_id`,`assigned_ai_employee_id`,`start_at`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`ticket_reference` text NOT NULL,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`customer_id` text,
	`lead_id` text,
	`conversation_id` text,
	`branch_id` text,
	`assigned_user_id` text,
	`assigned_human_employee_id` text,
	`assigned_ai_employee_id` text,
	`assigned_team_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`category` text,
	`resolution_summary` text,
	`opened_at` integer NOT NULL,
	`first_response_at` integer,
	`resolved_at` integer,
	`closed_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ticket_reference_unique` ON `tickets` (`ticket_reference`);--> statement-breakpoint
CREATE INDEX `tickets_business_status_priority_idx` ON `tickets` (`business_id`,`status`,`priority`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tickets_business_customer_idx` ON `tickets` (`business_id`,`customer_id`);--> statement-breakpoint
CREATE INDEX `tickets_business_assignee_idx` ON `tickets` (`business_id`,`assigned_user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `tickets_business_conversation_idx` ON `tickets` (`business_id`,`conversation_id`);