CREATE TABLE IF NOT EXISTS `plans` (
  `id` text PRIMARY KEY NOT NULL,
  `code` text NOT NULL UNIQUE,
  `name` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `monthly_price_cents` integer,
  `annual_price_cents` integer,
  `limits` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `plan_id` text NOT NULL,
  `status` text DEFAULT 'trialing' NOT NULL,
  `billing_interval` text,
  `provider` text,
  `provider_subscription_id` text,
  `started_at` integer NOT NULL,
  `current_period_ends_at` integer,
  `cancelled_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subscriptions_business_status_idx` ON `subscriptions` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `subscriptions_plan_status_idx` ON `subscriptions` (`plan_id`, `status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `usage_records` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `metric` text NOT NULL,
  `quantity` integer NOT NULL,
  `occurred_at` integer NOT NULL,
  `metadata` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usage_records_business_metric_occurred_idx` ON `usage_records` (`business_id`, `metric`, `occurred_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `platform_audit_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `actor_user_id` text,
  `action` text NOT NULL,
  `target_type` text NOT NULL,
  `target_id` text,
  `result` text NOT NULL,
  `metadata` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_audit_logs_actor_created_idx` ON `platform_audit_logs` (`actor_user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `platform_audit_logs_target_created_idx` ON `platform_audit_logs` (`target_type`, `target_id`, `created_at`);
