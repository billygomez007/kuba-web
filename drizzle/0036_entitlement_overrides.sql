CREATE TABLE `entitlement_overrides` (
  `id` text PRIMARY KEY NOT NULL,
  `business_id` text NOT NULL,
  `feature` text NOT NULL,
  `override_type` text NOT NULL,
  `value` text NOT NULL,
  `reason` text NOT NULL,
  `starts_at` integer NOT NULL,
  `expires_at` integer,
  `created_by` text NOT NULL,
  `created_at` integer NOT NULL
);