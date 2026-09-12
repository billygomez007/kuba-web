CREATE TABLE `outreach_campaign_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`prospect_id` text,
	`destination_channel` text NOT NULL,
	`destination_identity` text NOT NULL,
	`display_name` text,
	`personalization_context_version` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`current_step_number` integer,
	`next_send_at` integer,
	`enrolled_at` integer NOT NULL,
	`last_sent_at` integer,
	`last_reply_at` integer,
	`completed_at` integer,
	`suppressed_at` integer,
	`suppression_reason` text,
	`opted_out_at` integer,
	`handed_off_at` integer,
	`handoff_lead_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_campaign_recipients_campaign_contact_unique` ON `outreach_campaign_recipients` (`campaign_id`,`contact_id`);--> statement-breakpoint
CREATE INDEX `outreach_campaign_recipients_business_campaign_idx` ON `outreach_campaign_recipients` (`business_id`,`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `outreach_campaign_recipients_next_send_idx` ON `outreach_campaign_recipients` (`status`,`next_send_at`);--> statement-breakpoint
CREATE TABLE `outreach_campaign_sends` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`sequence_step_id` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`scheduled_at` integer NOT NULL,
	`claimed_at` integer,
	`claimed_by` text,
	`lease_expires_at` integer,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`last_attempt_at` integer,
	`next_attempt_at` integer,
	`completed_at` integer,
	`failure_code` text,
	`failure_reason` text,
	`external_message_id` text,
	`rendered_subject` text,
	`rendered_body` text,
	`personalization_metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_campaign_sends_recipient_step_unique` ON `outreach_campaign_sends` (`recipient_id`,`sequence_step_id`);--> statement-breakpoint
CREATE INDEX `outreach_campaign_sends_status_scheduled_idx` ON `outreach_campaign_sends` (`status`,`scheduled_at`);--> statement-breakpoint
CREATE INDEX `outreach_campaign_sends_business_campaign_idx` ON `outreach_campaign_sends` (`business_id`,`campaign_id`);--> statement-breakpoint
CREATE INDEX `outreach_campaign_sends_external_message_idx` ON `outreach_campaign_sends` (`external_message_id`);--> statement-breakpoint
CREATE TABLE `outreach_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`channel` text DEFAULT 'email' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`launched_by` text,
	`launched_at` integer,
	`scheduled_at` integer,
	`started_at` integer,
	`paused_at` integer,
	`completed_at` integer,
	`stopped_at` integer,
	`failed_at` integer,
	`failure_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outreach_campaigns_business_status_idx` ON `outreach_campaigns` (`business_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `outreach_campaigns_business_employee_idx` ON `outreach_campaigns` (`business_id`,`employee_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `outreach_sequence_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`delay_hours` integer DEFAULT 0 NOT NULL,
	`subject_template` text,
	`body_template` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_sequence_steps_campaign_step_unique` ON `outreach_sequence_steps` (`campaign_id`,`step_number`);--> statement-breakpoint
CREATE INDEX `outreach_sequence_steps_business_campaign_idx` ON `outreach_sequence_steps` (`business_id`,`campaign_id`);--> statement-breakpoint
CREATE TABLE `outreach_suppressions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`channel` text NOT NULL,
	`normalized_identity` text NOT NULL,
	`reason` text NOT NULL,
	`source_campaign_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outreach_suppressions_business_channel_identity_unique` ON `outreach_suppressions` (`business_id`,`channel`,`normalized_identity`);--> statement-breakpoint
ALTER TABLE `outreach_contacts` ADD `consent_status` text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE `outreach_contacts` ADD `consent_source` text;--> statement-breakpoint
ALTER TABLE `outreach_contacts` ADD `consent_captured_at` integer;