CREATE TABLE IF NOT EXISTS `ai_employee_teams` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `skills` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `slug` text NOT NULL,
  `description` text,
  `category` text NOT NULL,
  `type` text DEFAULT 'kuba_official' NOT NULL,
  `version` text DEFAULT '1.0' NOT NULL,
  `instructions` text,
  `tools` text,
  `status` text DEFAULT 'active' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `skills_slug_unique`
ON `skills` (`slug`);

CREATE TABLE IF NOT EXISTS `employee_skills` (
  `id` text PRIMARY KEY NOT NULL,
  `employee_id` text NOT NULL,
  `skill_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE INDEX IF NOT EXISTS `employeeSkills_employeeId_idx`
ON `employee_skills` (`employee_id`);

CREATE INDEX IF NOT EXISTS `employeeSkills_skillId_idx`
ON `employee_skills` (`skill_id`);
