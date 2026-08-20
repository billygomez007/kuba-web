CREATE TABLE `communication_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text,
	`customer_id` text,
	`lead_id` text,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text,
	`provider_message_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
