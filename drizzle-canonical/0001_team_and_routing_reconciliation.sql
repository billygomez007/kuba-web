CREATE TEMP TABLE `_0001_reconciliation_guard` (
	`assertion` text NOT NULL,
	`passed` integer NOT NULL CHECK (`passed` = 1)
);
--> statement-breakpoint

-- Verify the legacy source table exists.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'legacy ai_employee_teams source exists',
	CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` = 'ai_employee_teams';
--> statement-breakpoint

-- Verify the source table has exactly the known six-column legacy shape.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'ai_employee_teams has expected six-column legacy shape',
	CASE
		WHEN COUNT(*) = 6
			AND SUM(CASE WHEN `name` = 'id' AND upper(`type`) = 'TEXT' AND `pk` = 1 THEN 1 ELSE 0 END) = 1
			AND SUM(CASE WHEN `name` = 'business_id' AND upper(`type`) = 'TEXT' AND `notnull` = 1 THEN 1 ELSE 0 END) = 1
			AND SUM(CASE WHEN `name` = 'name' AND upper(`type`) = 'TEXT' AND `notnull` = 1 THEN 1 ELSE 0 END) = 1
			AND SUM(CASE WHEN `name` = 'description' AND upper(`type`) = 'TEXT' THEN 1 ELSE 0 END) = 1
			AND SUM(CASE WHEN `name` = 'created_at' AND upper(`type`) = 'INTEGER' AND `notnull` = 1 THEN 1 ELSE 0 END) = 1
			AND SUM(CASE WHEN `name` = 'updated_at' AND upper(`type`) = 'INTEGER' AND `notnull` = 1 THEN 1 ELSE 0 END) = 1
		THEN 1 ELSE 0
	END
FROM pragma_table_info('ai_employee_teams');
--> statement-breakpoint

-- Verify the legacy table contains no data.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'ai_employee_teams is empty',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `ai_employee_teams`;
--> statement-breakpoint

-- Prevent overwriting an earlier archive.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'legacy archive name is available',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` = 'legacy_ai_employee_teams_pre_0001';
--> statement-breakpoint

-- The remaining canonical tables must not already exist.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'business_teams is absent',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` = 'business_teams';
--> statement-breakpoint

INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'business_team_members is absent',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` = 'business_team_members';
--> statement-breakpoint

INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'conversation_routing is absent',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` = 'conversation_routing';
--> statement-breakpoint

ALTER TABLE `ai_employee_teams`
RENAME TO `legacy_ai_employee_teams_pre_0001`;
--> statement-breakpoint

CREATE TABLE `ai_employee_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`ai_employee_id` text NOT NULL,
	`team_id` text NOT NULL,
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

CREATE INDEX `business_teams_business_status_idx`
ON `business_teams` (`business_id`, `status`);
--> statement-breakpoint

CREATE TABLE `business_team_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`business_user_id` text NOT NULL,
	`created_at` integer NOT NULL
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

CREATE INDEX `conversation_routing_business_status_idx`
ON `conversation_routing` (`business_id`, `status`);
--> statement-breakpoint

CREATE INDEX `conversation_routing_conversation_idx`
ON `conversation_routing` (`conversation_id`);
--> statement-breakpoint

-- Verify all canonical tables and declared secondary indexes exist.
INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'all canonical tables exist',
	CASE WHEN COUNT(*) = 4 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` IN (
		'ai_employee_teams',
		'business_teams',
		'business_team_members',
		'conversation_routing'
	);
--> statement-breakpoint

INSERT INTO `_0001_reconciliation_guard` (`assertion`, `passed`)
SELECT
	'all declared secondary indexes exist',
	CASE WHEN COUNT(*) = 3 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'index'
	AND `name` IN (
		'business_teams_business_status_idx',
		'conversation_routing_business_status_idx',
		'conversation_routing_conversation_idx'
	);
--> statement-breakpoint

DROP TABLE `_0001_reconciliation_guard`;
