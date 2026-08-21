CREATE TEMP TABLE `_0004_hr_attendance_leave_guard` (
	`assertion` text NOT NULL,
	`passed` integer NOT NULL CHECK (`passed` = 1)
);
--> statement-breakpoint

INSERT INTO `_0004_hr_attendance_leave_guard` (`assertion`, `passed`)
SELECT
	'required 0002 and 0003 foundations exist',
	CASE WHEN COUNT(*) = 12 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` IN (
		'approval_requests',
		'approval_steps',
		'approval_events',
		'notification_templates',
		'notifications',
		'notification_deliveries',
		'hr_employees',
		'hr_departments',
		'hr_positions',
		'hr_employee_profiles',
		'hr_contracts',
		'hr_employment_status_history'
	);
--> statement-breakpoint

CREATE TABLE `hr_attendance_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`timezone` text NOT NULL,
	`grace_period_minutes` integer DEFAULT 0 NOT NULL,
	`absence_after_minutes` integer,
	`minimum_work_minutes` integer,
	`rounding_interval_minutes` integer DEFAULT 1 NOT NULL,
	`allow_remote_check_in` integer DEFAULT 0 NOT NULL,
	`require_location` integer DEFAULT 0 NOT NULL,
	`require_correction_approval` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_work_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`attendance_policy_id` text NOT NULL,
	`employee_id` text,
	`department_id` text,
	`position_id` text,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`schedule_rules` text NOT NULL,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`attendance_policy_id` text,
	`work_schedule_id` text,
	`work_date` integer NOT NULL,
	`expected_check_in_at` integer,
	`expected_check_out_at` integer,
	`checked_in_at` integer,
	`checked_out_at` integer,
	`worked_minutes` integer DEFAULT 0 NOT NULL,
	`late_minutes` integer DEFAULT 0 NOT NULL,
	`overtime_minutes` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`check_in_source` text,
	`check_out_source` text,
	`check_in_location` text,
	`check_out_location` text,
	`notes` text,
	`locked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_attendance_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`attendance_record_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`requested_by_user_id` text NOT NULL,
	`requested_check_in_at` integer,
	`requested_check_out_at` integer,
	`requested_status` text,
	`reason` text NOT NULL,
	`approval_request_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`decided_by_user_id` text,
	`decision_note` text,
	`decided_at` integer,
	`applied_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_leave_types` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit` text DEFAULT 'days' NOT NULL,
	`is_paid` integer DEFAULT 1 NOT NULL,
	`requires_approval` integer DEFAULT 1 NOT NULL,
	`allow_negative_balance` integer DEFAULT 0 NOT NULL,
	`accrual_method` text NOT NULL,
	`default_entitlement_minutes` integer DEFAULT 0 NOT NULL,
	`maximum_carryover_minutes` integer,
	`minimum_notice_days` integer DEFAULT 0 NOT NULL,
	`maximum_consecutive_days` integer,
	`requires_document` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_leave_balances` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`opening_minutes` integer DEFAULT 0 NOT NULL,
	`accrued_minutes` integer DEFAULT 0 NOT NULL,
	`carried_over_minutes` integer DEFAULT 0 NOT NULL,
	`adjusted_minutes` integer DEFAULT 0 NOT NULL,
	`pending_minutes` integer DEFAULT 0 NOT NULL,
	`used_minutes` integer DEFAULT 0 NOT NULL,
	`updated_by_user_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_leave_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`leave_balance_id` text,
	`requested_by_user_id` text NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer NOT NULL,
	`start_segment` text DEFAULT 'full_day' NOT NULL,
	`end_segment` text DEFAULT 'full_day' NOT NULL,
	`requested_minutes` integer NOT NULL,
	`reason` text,
	`handover_notes` text,
	`emergency_contact` text,
	`approval_request_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`submitted_at` integer,
	`decided_at` integer,
	`cancelled_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_leave_history` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`leave_type_id` text NOT NULL,
	`leave_request_id` text,
	`leave_balance_id` text,
	`actor_type` text NOT NULL,
	`actor_user_id` text,
	`event_type` text NOT NULL,
	`minutes_delta` integer DEFAULT 0 NOT NULL,
	`balance_before_minutes` integer,
	`balance_after_minutes` integer,
	`from_status` text,
	`to_status` text,
	`reason` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_attendance_policies_business_code_uidx`
ON `hr_attendance_policies` (`business_id`, `code`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_policies_business_status_idx`
ON `hr_attendance_policies` (`business_id`, `status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_work_schedules_business_code_uidx`
ON `hr_work_schedules` (`business_id`, `code`);
--> statement-breakpoint

CREATE INDEX `hr_work_schedules_business_employee_effective_idx`
ON `hr_work_schedules` (`business_id`, `employee_id`, `effective_from`, `effective_to`);
--> statement-breakpoint

CREATE INDEX `hr_work_schedules_business_department_status_idx`
ON `hr_work_schedules` (`business_id`, `department_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_work_schedules_business_position_status_idx`
ON `hr_work_schedules` (`business_id`, `position_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_work_schedules_business_policy_idx`
ON `hr_work_schedules` (`business_id`, `attendance_policy_id`);
--> statement-breakpoint

CREATE INDEX `hr_work_schedules_business_status_effective_idx`
ON `hr_work_schedules` (`business_id`, `status`, `effective_from`, `effective_to`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_attendance_records_business_employee_date_uidx`
ON `hr_attendance_records` (`business_id`, `employee_id`, `work_date`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_records_business_date_status_idx`
ON `hr_attendance_records` (`business_id`, `work_date`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_records_business_employee_date_idx`
ON `hr_attendance_records` (`business_id`, `employee_id`, `work_date`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_records_business_schedule_date_idx`
ON `hr_attendance_records` (`business_id`, `work_schedule_id`, `work_date`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_records_business_late_date_idx`
ON `hr_attendance_records` (`business_id`, `late_minutes`, `work_date`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_corrections_business_record_idx`
ON `hr_attendance_corrections` (`business_id`, `attendance_record_id`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_corrections_business_employee_status_idx`
ON `hr_attendance_corrections` (`business_id`, `employee_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_attendance_corrections_business_status_created_idx`
ON `hr_attendance_corrections` (`business_id`, `status`, `created_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_attendance_corrections_business_approval_uidx`
ON `hr_attendance_corrections` (`business_id`, `approval_request_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_leave_types_business_code_uidx`
ON `hr_leave_types` (`business_id`, `code`);
--> statement-breakpoint

CREATE INDEX `hr_leave_types_business_status_idx`
ON `hr_leave_types` (`business_id`, `status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_leave_balances_business_employee_type_period_uidx`
ON `hr_leave_balances` (`business_id`, `employee_id`, `leave_type_id`, `period_start`, `period_end`);
--> statement-breakpoint

CREATE INDEX `hr_leave_balances_business_employee_period_idx`
ON `hr_leave_balances` (`business_id`, `employee_id`, `period_start`, `period_end`);
--> statement-breakpoint

CREATE INDEX `hr_leave_balances_business_type_period_idx`
ON `hr_leave_balances` (`business_id`, `leave_type_id`, `period_start`, `period_end`);
--> statement-breakpoint

CREATE INDEX `hr_leave_requests_business_employee_status_idx`
ON `hr_leave_requests` (`business_id`, `employee_id`, `status`, `start_date`);
--> statement-breakpoint

CREATE INDEX `hr_leave_requests_business_status_start_idx`
ON `hr_leave_requests` (`business_id`, `status`, `start_date`);
--> statement-breakpoint

CREATE INDEX `hr_leave_requests_business_type_status_idx`
ON `hr_leave_requests` (`business_id`, `leave_type_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_leave_requests_business_balance_idx`
ON `hr_leave_requests` (`business_id`, `leave_balance_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_leave_requests_business_approval_uidx`
ON `hr_leave_requests` (`business_id`, `approval_request_id`);
--> statement-breakpoint

CREATE INDEX `hr_leave_history_business_employee_created_idx`
ON `hr_leave_history` (`business_id`, `employee_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `hr_leave_history_business_request_created_idx`
ON `hr_leave_history` (`business_id`, `leave_request_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `hr_leave_history_business_balance_created_idx`
ON `hr_leave_history` (`business_id`, `leave_balance_id`, `created_at`);
--> statement-breakpoint

CREATE INDEX `hr_leave_history_business_type_event_idx`
ON `hr_leave_history` (`business_id`, `leave_type_id`, `event_type`, `created_at`);
--> statement-breakpoint

INSERT INTO `_0004_hr_attendance_leave_guard` (`assertion`, `passed`)
SELECT
	'all 0004 HR attendance and leave tables exist',
	CASE WHEN COUNT(*) = 8 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` IN (
		'hr_attendance_policies',
		'hr_work_schedules',
		'hr_attendance_records',
		'hr_attendance_corrections',
		'hr_leave_types',
		'hr_leave_balances',
		'hr_leave_requests',
		'hr_leave_history'
	);
--> statement-breakpoint

INSERT INTO `_0004_hr_attendance_leave_guard` (`assertion`, `passed`)
SELECT
	'all 0004 HR attendance and leave indexes exist',
	CASE WHEN COUNT(*) = 31 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'index'
	AND `name` IN (
		'hr_attendance_policies_business_code_uidx',
		'hr_attendance_policies_business_status_idx',
		'hr_work_schedules_business_code_uidx',
		'hr_work_schedules_business_employee_effective_idx',
		'hr_work_schedules_business_department_status_idx',
		'hr_work_schedules_business_position_status_idx',
		'hr_work_schedules_business_policy_idx',
		'hr_work_schedules_business_status_effective_idx',
		'hr_attendance_records_business_employee_date_uidx',
		'hr_attendance_records_business_date_status_idx',
		'hr_attendance_records_business_employee_date_idx',
		'hr_attendance_records_business_schedule_date_idx',
		'hr_attendance_records_business_late_date_idx',
		'hr_attendance_corrections_business_record_idx',
		'hr_attendance_corrections_business_employee_status_idx',
		'hr_attendance_corrections_business_status_created_idx',
		'hr_attendance_corrections_business_approval_uidx',
		'hr_leave_types_business_code_uidx',
		'hr_leave_types_business_status_idx',
		'hr_leave_balances_business_employee_type_period_uidx',
		'hr_leave_balances_business_employee_period_idx',
		'hr_leave_balances_business_type_period_idx',
		'hr_leave_requests_business_employee_status_idx',
		'hr_leave_requests_business_status_start_idx',
		'hr_leave_requests_business_type_status_idx',
		'hr_leave_requests_business_balance_idx',
		'hr_leave_requests_business_approval_uidx',
		'hr_leave_history_business_employee_created_idx',
		'hr_leave_history_business_request_created_idx',
		'hr_leave_history_business_balance_created_idx',
		'hr_leave_history_business_type_event_idx'
	);
--> statement-breakpoint

INSERT INTO `_0004_hr_attendance_leave_guard` (`assertion`, `passed`)
SELECT
	'all 0004 tables have a required business_id column',
	CASE WHEN COUNT(*) = 8 THEN 1 ELSE 0 END
FROM (
	SELECT 'hr_attendance_policies' AS `table_name`, `name`, `notnull` FROM pragma_table_info('hr_attendance_policies')
	UNION ALL SELECT 'hr_work_schedules', `name`, `notnull` FROM pragma_table_info('hr_work_schedules')
	UNION ALL SELECT 'hr_attendance_records', `name`, `notnull` FROM pragma_table_info('hr_attendance_records')
	UNION ALL SELECT 'hr_attendance_corrections', `name`, `notnull` FROM pragma_table_info('hr_attendance_corrections')
	UNION ALL SELECT 'hr_leave_types', `name`, `notnull` FROM pragma_table_info('hr_leave_types')
	UNION ALL SELECT 'hr_leave_balances', `name`, `notnull` FROM pragma_table_info('hr_leave_balances')
	UNION ALL SELECT 'hr_leave_requests', `name`, `notnull` FROM pragma_table_info('hr_leave_requests')
	UNION ALL SELECT 'hr_leave_history', `name`, `notnull` FROM pragma_table_info('hr_leave_history')
)
WHERE `name` = 'business_id'
	AND `notnull` = 1;
--> statement-breakpoint

INSERT INTO `_0004_hr_attendance_leave_guard` (`assertion`, `passed`)
SELECT
	'0004 added no foreign keys',
	CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END
FROM (
	SELECT * FROM pragma_foreign_key_list('hr_attendance_policies')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_work_schedules')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_attendance_records')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_attendance_corrections')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_leave_types')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_leave_balances')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_leave_requests')
	UNION ALL SELECT * FROM pragma_foreign_key_list('hr_leave_history')
);
--> statement-breakpoint

DROP TABLE `_0004_hr_attendance_leave_guard`;
