CREATE TABLE `subscriptions` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL UNIQUE,
  `provider` text NOT NULL,
  `provider_customer_id` text,
  `provider_subscription_id` text UNIQUE,
  `provider_authorization_reference` text,
  `provider_event_id` text UNIQUE,
  `plan` text NOT NULL DEFAULT 'starter',
  `status` text NOT NULL DEFAULT 'incomplete',
  `current_period_start` integer,
  `current_period_end` integer,
  `cancel_at_period_end` integer NOT NULL DEFAULT 0,
  `trial_end` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);