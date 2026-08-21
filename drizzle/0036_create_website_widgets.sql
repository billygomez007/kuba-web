CREATE TABLE IF NOT EXISTS `website_widgets` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `name` text NOT NULL,
  `website_url` text,
  `employee_id` text,
  `public_key` text NOT NULL,
  `status` text DEFAULT 'active' NOT NULL,
  `welcome_message` text,
  `position` text DEFAULT 'bottom-right' NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `website_widgets_public_key_unique`
ON `website_widgets` (`public_key`);
