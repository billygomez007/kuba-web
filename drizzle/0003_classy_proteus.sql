CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`external_conversation_id` text,
	`customer_name` text,
	`customer_phone` text,
	`customer_email` text,
	`assigned_employee_id` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`external_account_id` text,
	`external_phone_number_id` text,
	`display_name` text,
	`credentials_encrypted` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`integration_id` text NOT NULL,
	`external_message_id` text,
	`direction` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_id` text,
	`content` text NOT NULL,
	`message_type` text DEFAULT 'text' NOT NULL,
	`created_at` integer NOT NULL
);
