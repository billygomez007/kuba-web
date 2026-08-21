CREATE TABLE `business_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`module_key` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`activated_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `approval_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`approval_type` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`requested_by_type` text NOT NULL,
	`requested_by_user_id` text,
	`requested_by_ai_employee_id` text,
	`title` text NOT NULL,
	`description` text,
	`payload` text NOT NULL,
	`required_permission` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`current_step` integer DEFAULT 1 NOT NULL,
	`total_steps` integer DEFAULT 1 NOT NULL,
	`idempotency_key` text,
	`legacy_action_approval_id` text,
	`expires_at` integer,
	`decided_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `approval_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`approval_request_id` text NOT NULL,
	`step_number` integer NOT NULL,
	`approver_user_id` text,
	`required_role` text,
	`required_permission` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`decision` text,
	`decision_note` text,
	`decided_by_user_id` text,
	`decided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `approval_events` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`approval_request_id` text NOT NULL,
	`approval_step_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`actor_ai_employee_id` text,
	`event_type` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `notification_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`template_key` text NOT NULL,
	`channel` text NOT NULL,
	`locale` text DEFAULT 'en' NOT NULL,
	`name` text NOT NULL,
	`subject_template` text,
	`body_template` text NOT NULL,
	`allowed_variables` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`resource_type` text,
	`resource_id` text,
	`action_url` text,
	`priority` text DEFAULT 'normal' NOT NULL,
	`metadata` text,
	`read_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `notification_deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`notification_id` text NOT NULL,
	`template_id` text,
	`channel` text NOT NULL,
	`recipient` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`provider` text,
	`provider_message_id` text,
	`idempotency_key` text,
	`scheduled_at` integer,
	`last_attempt_at` integer,
	`sent_at` integer,
	`delivered_at` integer,
	`failed_at` integer,
	`error_code` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `ai_employee_scopes` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`ai_employee_id` text NOT NULL,
	`scope` text NOT NULL,
	`effect` text DEFAULT 'allow' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by_user_id` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX `business_modules_business_module_uidx`
ON `business_modules` (`business_id`, `module_key`);
--> statement-breakpoint

CREATE INDEX `business_modules_business_idx`
ON `business_modules` (`business_id`);
--> statement-breakpoint

CREATE INDEX `business_modules_business_status_idx`
ON `business_modules` (`business_id`, `status`);
--> statement-breakpoint

CREATE INDEX `approval_requests_business_status_created_idx`
ON `approval_requests` (`business_id`, `status`, `created_at`);
--> statement-breakpoint

CREATE INDEX `approval_requests_business_type_status_idx`
ON `approval_requests` (`business_id`, `approval_type`, `status`);
--> statement-breakpoint

CREATE INDEX `approval_requests_business_resource_idx`
ON `approval_requests` (`business_id`, `resource_type`, `resource_id`);
--> statement-breakpoint

CREATE INDEX `approval_requests_business_requester_idx`
ON `approval_requests` (`business_id`, `requested_by_user_id`, `created_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX `approval_requests_business_idempotency_uidx`
ON `approval_requests` (`business_id`, `idempotency_key`);
--> statement-breakpoint

CREATE UNIQUE INDEX `approval_requests_legacy_action_uidx`
ON `approval_requests` (`legacy_action_approval_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `approval_steps_request_step_uidx`
ON `approval_steps` (`business_id`, `approval_request_id`, `step_number`);
--> statement-breakpoint

CREATE INDEX `approval_steps_business_status_idx`
ON `approval_steps` (`business_id`, `status`, `created_at`);
--> statement-breakpoint

CREATE INDEX `approval_steps_business_approver_status_idx`
ON `approval_steps` (`business_id`, `approver_user_id`, `status`);
--> statement-breakpoint

CREATE INDEX `approval_events_business_request_created_idx`
ON `approval_events` (`business_id`, `approval_request_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `approval_events_business_actor_created_idx`
ON `approval_events` (`business_id`, `actor_user_id`, `created_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX `notification_templates_business_key_channel_locale_uidx`
ON `notification_templates` (`business_id`, `template_key`, `channel`, `locale`);
--> statement-breakpoint

CREATE INDEX `notification_templates_business_status_idx`
ON `notification_templates` (`business_id`, `status`);
--> statement-breakpoint

CREATE INDEX `notifications_business_recipient_read_idx`
ON `notifications` (`business_id`, `recipient_user_id`, `read_at`, `created_at`);
--> statement-breakpoint

CREATE INDEX `notifications_business_recipient_created_idx`
ON `notifications` (`business_id`, `recipient_user_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `notifications_business_resource_idx`
ON `notifications` (`business_id`, `resource_type`, `resource_id`);
--> statement-breakpoint

CREATE INDEX `notification_deliveries_business_status_scheduled_idx`
ON `notification_deliveries` (`business_id`, `status`, `scheduled_at`);
--> statement-breakpoint

CREATE INDEX `notification_deliveries_business_notification_idx`
ON `notification_deliveries` (`business_id`, `notification_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `notification_deliveries_business_idempotency_uidx`
ON `notification_deliveries` (`business_id`, `idempotency_key`);
--> statement-breakpoint

CREATE INDEX `notification_deliveries_business_provider_message_idx`
ON `notification_deliveries` (`business_id`, `provider`, `provider_message_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `ai_employee_scopes_business_employee_scope_uidx`
ON `ai_employee_scopes` (`business_id`, `ai_employee_id`, `scope`);
--> statement-breakpoint

CREATE INDEX `ai_employee_scopes_business_scope_status_idx`
ON `ai_employee_scopes` (`business_id`, `scope`, `status`);
--> statement-breakpoint

CREATE INDEX `ai_employee_scopes_business_employee_status_idx`
ON `ai_employee_scopes` (`business_id`, `ai_employee_id`, `status`);
--> statement-breakpoint

CREATE TEMP TABLE `_0002_foundation_guard` (
	`assertion` text NOT NULL,
	`passed` integer NOT NULL CHECK (`passed` = 1)
);
--> statement-breakpoint

INSERT INTO `_0002_foundation_guard` (`assertion`, `passed`)
SELECT
	'all 0002 foundation tables exist',
	CASE WHEN COUNT(*) = 8 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` IN (
		'business_modules',
		'approval_requests',
		'approval_steps',
		'approval_events',
		'notification_templates',
		'notifications',
		'notification_deliveries',
		'ai_employee_scopes'
	);
--> statement-breakpoint

INSERT INTO `_0002_foundation_guard` (`assertion`, `passed`)
SELECT
	'all 0002 foundation indexes exist',
	CASE WHEN COUNT(*) = 26 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'index'
	AND `name` IN (
		'business_modules_business_module_uidx',
		'business_modules_business_idx',
		'business_modules_business_status_idx',
		'approval_requests_business_status_created_idx',
		'approval_requests_business_type_status_idx',
		'approval_requests_business_resource_idx',
		'approval_requests_business_requester_idx',
		'approval_requests_business_idempotency_uidx',
		'approval_requests_legacy_action_uidx',
		'approval_steps_request_step_uidx',
		'approval_steps_business_status_idx',
		'approval_steps_business_approver_status_idx',
		'approval_events_business_request_created_idx',
		'approval_events_business_actor_created_idx',
		'notification_templates_business_key_channel_locale_uidx',
		'notification_templates_business_status_idx',
		'notifications_business_recipient_read_idx',
		'notifications_business_recipient_created_idx',
		'notifications_business_resource_idx',
		'notification_deliveries_business_status_scheduled_idx',
		'notification_deliveries_business_notification_idx',
		'notification_deliveries_business_idempotency_uidx',
		'notification_deliveries_business_provider_message_idx',
		'ai_employee_scopes_business_employee_scope_uidx',
		'ai_employee_scopes_business_scope_status_idx',
		'ai_employee_scopes_business_employee_status_idx'
	);
--> statement-breakpoint

DROP TABLE `_0002_foundation_guard`;
