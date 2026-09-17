CREATE TABLE `marketing_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`requested_by_user_id` text,
	`requested_by_employee_id` text,
	`reviewed_by_user_id` text,
	`reviewed_at` integer,
	`comment` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_approvals_business_status_idx` ON `marketing_approvals` (`business_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `marketing_approvals_resource_idx` ON `marketing_approvals` (`business_id`,`resource_type`,`resource_id`);--> statement-breakpoint
CREATE TABLE `marketing_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text,
	`name` text NOT NULL,
	`asset_type` text NOT NULL,
	`file_reference` text NOT NULL,
	`mime_type` text,
	`size_bytes` integer,
	`alt_text` text,
	`metadata` text,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_assets_business_campaign_idx` ON `marketing_assets` (`business_id`,`campaign_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `marketing_attributions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`customer_id` text,
	`lead_id` text,
	`deal_id` text,
	`event_type` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`value` integer,
	`currency` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_attributions_business_campaign_idx` ON `marketing_attributions` (`business_id`,`campaign_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `marketing_attributions_business_event_idx` ON `marketing_attributions` (`business_id`,`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `marketing_audience_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`audience_id` text NOT NULL,
	`field` text NOT NULL,
	`operator` text NOT NULL,
	`value` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_audience_rules_business_audience_idx` ON `marketing_audience_rules` (`business_id`,`audience_id`,`position`);--> statement-breakpoint
CREATE TABLE `marketing_audiences` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`estimated_count` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_audiences_business_idx` ON `marketing_audiences` (`business_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `marketing_campaign_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text NOT NULL,
	`channel` text NOT NULL,
	`social_account_id` text,
	`status` text DEFAULT 'planned' NOT NULL,
	`scheduled_start` integer,
	`scheduled_end` integer,
	`objective_override` text,
	`audience_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_campaign_channels_business_campaign_idx` ON `marketing_campaign_channels` (`business_id`,`campaign_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_campaign_channels_campaign_channel_unique` ON `marketing_campaign_channels` (`campaign_id`,`channel`);--> statement-breakpoint
CREATE TABLE `marketing_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`objective` text DEFAULT 'other' NOT NULL,
	`campaign_type` text DEFAULT 'organic' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`target_audience_id` text,
	`offer` text,
	`landing_url` text,
	`timezone` text,
	`start_at` integer,
	`end_at` integer,
	`budget_amount` integer,
	`budget_currency` text DEFAULT 'USD' NOT NULL,
	`owner_user_id` text,
	`owner_employee_id` text,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text,
	`created_by_employee_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_campaigns_business_status_idx` ON `marketing_campaigns` (`business_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `marketing_campaigns_business_dates_idx` ON `marketing_campaigns` (`business_id`,`start_at`,`end_at`);--> statement-breakpoint
CREATE TABLE `marketing_content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text,
	`title` text NOT NULL,
	`content_type` text DEFAULT 'post' NOT NULL,
	`brief` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`approval_status` text DEFAULT 'draft' NOT NULL,
	`created_by_user_id` text,
	`created_by_employee_id` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_content_items_business_status_idx` ON `marketing_content_items` (`business_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `marketing_content_items_business_campaign_idx` ON `marketing_content_items` (`business_id`,`campaign_id`);--> statement-breakpoint
CREATE TABLE `marketing_content_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`content_item_id` text NOT NULL,
	`channel` text NOT NULL,
	`headline` text,
	`text` text NOT NULL,
	`description` text,
	`call_to_action` text,
	`link_url` text,
	`hashtags` text,
	`scheduled_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_content_variants_business_schedule_idx` ON `marketing_content_variants` (`business_id`,`scheduled_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_content_variants_item_channel_unique` ON `marketing_content_variants` (`content_item_id`,`channel`);--> statement-breakpoint
CREATE TABLE `marketing_metric_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`currency` text,
	`captured_at` integer NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_metric_snapshots_business_metric_idx` ON `marketing_metric_snapshots` (`business_id`,`metric`,`captured_at`);--> statement-breakpoint
CREATE TABLE `marketing_publish_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`campaign_id` text,
	`content_item_id` text NOT NULL,
	`content_variant_id` text,
	`social_account_id` text,
	`channel` text NOT NULL,
	`scheduled_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text NOT NULL,
	`provider_post_id` text,
	`published_at` integer,
	`failed_at` integer,
	`failure_code` text,
	`failure_message_safe` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_publish_jobs_business_schedule_idx` ON `marketing_publish_jobs` (`business_id`,`scheduled_at`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_publish_jobs_idempotency_unique` ON `marketing_publish_jobs` (`business_id`,`idempotency_key`);--> statement-breakpoint
CREATE TABLE `marketing_social_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`provider` text NOT NULL,
	`external_account_id` text,
	`display_name` text NOT NULL,
	`handle` text,
	`account_type` text,
	`status` text DEFAULT 'not_connected' NOT NULL,
	`metadata` text,
	`connected_at` integer,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `marketing_social_accounts_business_provider_idx` ON `marketing_social_accounts` (`business_id`,`provider`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `marketing_social_accounts_business_external_unique` ON `marketing_social_accounts` (`business_id`,`provider`,`external_account_id`);