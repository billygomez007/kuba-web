CREATE TABLE `conversation_routing` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `conversation_id` text NOT NULL,
  `department` text NOT NULL,
  `team_id` text,
  `ai_employee_id` text,
  `assigned_user_id` text,
  `assignment_type` text NOT NULL DEFAULT 'ai',
  `status` text NOT NULL DEFAULT 'ai_handling',
  `priority` text NOT NULL DEFAULT 'normal',
  `confidence` integer NOT NULL DEFAULT 0,
  `routing_reason` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `conversation_routing_conversation_unique`
ON `conversation_routing` (`conversation_id`);

CREATE INDEX `conversation_routing_business_idx`
ON `conversation_routing` (`business_id`);

CREATE INDEX `conversation_routing_team_idx`
ON `conversation_routing` (`team_id`);

CREATE INDEX `conversation_routing_department_idx`
ON `conversation_routing` (`department`);

CREATE INDEX `conversation_routing_assigned_user_idx`
ON `conversation_routing` (`assigned_user_id`);
