CREATE TABLE `hr_departments` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`parent_department_id` text,
	`manager_employee_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_positions` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`department_id` text,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`grade` text,
	`employment_type` text,
	`reports_to_position_id` text,
	`headcount_limit` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_employees` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`business_user_id` text,
	`employee_number` text NOT NULL,
	`display_name` text NOT NULL,
	`department_id` text,
	`position_id` text,
	`manager_employee_id` text,
	`branch_id` text,
	`work_email` text,
	`work_phone` text,
	`hire_date` integer NOT NULL,
	`employment_type` text NOT NULL,
	`employment_status` text DEFAULT 'active' NOT NULL,
	`termination_date` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_employee_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`legal_first_name` text NOT NULL,
	`legal_middle_name` text,
	`legal_last_name` text NOT NULL,
	`preferred_name` text,
	`date_of_birth` integer,
	`gender` text,
	`nationality` text,
	`personal_email` text,
	`personal_phone` text,
	`address` text,
	`emergency_contact_name` text,
	`emergency_contact_relationship` text,
	`emergency_contact_phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`position_id` text,
	`contract_number` text NOT NULL,
	`contract_type` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`probation_end_date` integer,
	`work_location` text,
	`hours_per_week` integer,
	`terms_summary` text,
	`approval_request_id` text,
	`signed_at` integer,
	`approved_at` integer,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_employee_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`contract_id` text,
	`document_type` text NOT NULL,
	`title` text NOT NULL,
	`storage_provider` text NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`checksum` text,
	`visibility` text DEFAULT 'hr_only' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer,
	`uploaded_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE `hr_employment_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`previous_status` text,
	`new_status` text NOT NULL,
	`reason` text,
	`effective_at` integer NOT NULL,
	`changed_by_user_id` text NOT NULL,
	`approval_request_id` text,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_departments_business_code_uidx`
ON `hr_departments` (`business_id`, `code`);
--> statement-breakpoint

CREATE INDEX `hr_departments_business_status_idx`
ON `hr_departments` (`business_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_departments_business_parent_idx`
ON `hr_departments` (`business_id`, `parent_department_id`);
--> statement-breakpoint

CREATE INDEX `hr_departments_business_manager_idx`
ON `hr_departments` (`business_id`, `manager_employee_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_positions_business_code_uidx`
ON `hr_positions` (`business_id`, `code`);
--> statement-breakpoint

CREATE INDEX `hr_positions_business_department_status_idx`
ON `hr_positions` (`business_id`, `department_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_positions_business_reports_to_idx`
ON `hr_positions` (`business_id`, `reports_to_position_id`);
--> statement-breakpoint

CREATE INDEX `hr_positions_business_status_idx`
ON `hr_positions` (`business_id`, `status`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_employees_business_number_uidx`
ON `hr_employees` (`business_id`, `employee_number`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_employees_business_user_uidx`
ON `hr_employees` (`business_id`, `business_user_id`);
--> statement-breakpoint

CREATE INDEX `hr_employees_business_status_idx`
ON `hr_employees` (`business_id`, `employment_status`);
--> statement-breakpoint

CREATE INDEX `hr_employees_business_department_status_idx`
ON `hr_employees` (`business_id`, `department_id`, `employment_status`);
--> statement-breakpoint

CREATE INDEX `hr_employees_business_position_idx`
ON `hr_employees` (`business_id`, `position_id`);
--> statement-breakpoint

CREATE INDEX `hr_employees_business_manager_idx`
ON `hr_employees` (`business_id`, `manager_employee_id`);
--> statement-breakpoint

CREATE INDEX `hr_employees_business_branch_idx`
ON `hr_employees` (`business_id`, `branch_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_employee_profiles_business_employee_uidx`
ON `hr_employee_profiles` (`business_id`, `employee_id`);
--> statement-breakpoint

CREATE INDEX `hr_employee_profiles_business_name_idx`
ON `hr_employee_profiles` (`business_id`, `legal_last_name`, `legal_first_name`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_contracts_business_number_uidx`
ON `hr_contracts` (`business_id`, `contract_number`);
--> statement-breakpoint

CREATE INDEX `hr_contracts_business_employee_status_idx`
ON `hr_contracts` (`business_id`, `employee_id`, `status`);
--> statement-breakpoint

CREATE INDEX `hr_contracts_business_status_end_idx`
ON `hr_contracts` (`business_id`, `status`, `end_date`);
--> statement-breakpoint

CREATE INDEX `hr_contracts_business_approval_idx`
ON `hr_contracts` (`business_id`, `approval_request_id`);
--> statement-breakpoint

CREATE INDEX `hr_contracts_business_position_idx`
ON `hr_contracts` (`business_id`, `position_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX `hr_employee_documents_business_storage_uidx`
ON `hr_employee_documents` (`business_id`, `storage_key`);
--> statement-breakpoint

CREATE INDEX `hr_employee_documents_business_employee_type_idx`
ON `hr_employee_documents` (`business_id`, `employee_id`, `document_type`);
--> statement-breakpoint

CREATE INDEX `hr_employee_documents_business_contract_idx`
ON `hr_employee_documents` (`business_id`, `contract_id`);
--> statement-breakpoint

CREATE INDEX `hr_employee_documents_business_status_expiry_idx`
ON `hr_employee_documents` (`business_id`, `status`, `expires_at`);
--> statement-breakpoint

CREATE INDEX `hr_employment_status_history_business_employee_effective_idx`
ON `hr_employment_status_history` (`business_id`, `employee_id`, `effective_at`);
--> statement-breakpoint

CREATE INDEX `hr_employment_status_history_business_status_effective_idx`
ON `hr_employment_status_history` (`business_id`, `new_status`, `effective_at`);
--> statement-breakpoint

CREATE INDEX `hr_employment_status_history_business_approval_idx`
ON `hr_employment_status_history` (`business_id`, `approval_request_id`);
--> statement-breakpoint

CREATE TEMP TABLE `_0003_hr_core_guard` (
	`assertion` text NOT NULL,
	`passed` integer NOT NULL CHECK (`passed` = 1)
);
--> statement-breakpoint

INSERT INTO `_0003_hr_core_guard` (`assertion`, `passed`)
SELECT
	'all 0003 HR core tables exist',
	CASE WHEN COUNT(*) = 7 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'table'
	AND `name` IN (
		'hr_departments',
		'hr_positions',
		'hr_employees',
		'hr_employee_profiles',
		'hr_contracts',
		'hr_employee_documents',
		'hr_employment_status_history'
	);
--> statement-breakpoint

INSERT INTO `_0003_hr_core_guard` (`assertion`, `passed`)
SELECT
	'all 0003 HR core indexes exist',
	CASE WHEN COUNT(*) = 29 THEN 1 ELSE 0 END
FROM `sqlite_master`
WHERE `type` = 'index'
	AND `name` IN (
		'hr_departments_business_code_uidx',
		'hr_departments_business_status_idx',
		'hr_departments_business_parent_idx',
		'hr_departments_business_manager_idx',
		'hr_positions_business_code_uidx',
		'hr_positions_business_department_status_idx',
		'hr_positions_business_reports_to_idx',
		'hr_positions_business_status_idx',
		'hr_employees_business_number_uidx',
		'hr_employees_business_user_uidx',
		'hr_employees_business_status_idx',
		'hr_employees_business_department_status_idx',
		'hr_employees_business_position_idx',
		'hr_employees_business_manager_idx',
		'hr_employees_business_branch_idx',
		'hr_employee_profiles_business_employee_uidx',
		'hr_employee_profiles_business_name_idx',
		'hr_contracts_business_number_uidx',
		'hr_contracts_business_employee_status_idx',
		'hr_contracts_business_status_end_idx',
		'hr_contracts_business_approval_idx',
		'hr_contracts_business_position_idx',
		'hr_employee_documents_business_storage_uidx',
		'hr_employee_documents_business_employee_type_idx',
		'hr_employee_documents_business_contract_idx',
		'hr_employee_documents_business_status_expiry_idx',
		'hr_employment_status_history_business_employee_effective_idx',
		'hr_employment_status_history_business_status_effective_idx',
		'hr_employment_status_history_business_approval_idx'
	);
--> statement-breakpoint

DROP TABLE `_0003_hr_core_guard`;
