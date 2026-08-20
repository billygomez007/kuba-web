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

CREATE TABLE `business_team_members` (
  `id` text PRIMARY KEY NOT NULL,
  `team_id` text NOT NULL,
  `business_user_id` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `business_team_members_unique`
ON `business_team_members`
(`team_id`, `business_user_id`);

CREATE TABLE `ai_employee_teams` (
  `id` text PRIMARY KEY NOT NULL,
  `ai_employee_id` text NOT NULL,
  `team_id` text NOT NULL,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `ai_employee_teams_unique`
ON `ai_employee_teams`
(`ai_employee_id`, `team_id`);
