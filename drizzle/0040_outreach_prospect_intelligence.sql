CREATE TABLE `outreach_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`prospect_id` text NOT NULL,
	`name` text,
	`job_title` text,
	`email` text,
	`phone` text,
	`contact_page_url` text,
	`source_url` text,
	`contact_type` text DEFAULT 'business' NOT NULL,
	`verification_status` text DEFAULT 'unverified' NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`do_not_contact` integer DEFAULT false NOT NULL,
	`opted_out_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outreach_contacts_business_prospect_idx` ON `outreach_contacts` (`business_id`,`prospect_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `outreach_contacts_business_email_idx` ON `outreach_contacts` (`business_id`,`email`);--> statement-breakpoint
CREATE INDEX `outreach_contacts_business_phone_idx` ON `outreach_contacts` (`business_id`,`phone`);--> statement-breakpoint
CREATE INDEX `outreach_contacts_business_dnc_idx` ON `outreach_contacts` (`business_id`,`do_not_contact`,`updated_at`);--> statement-breakpoint
CREATE TABLE `outreach_prospects` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`company_name` text NOT NULL,
	`normalized_company_name` text NOT NULL,
	`website` text,
	`normalized_domain` text,
	`industry` text,
	`country` text,
	`city` text,
	`description` text,
	`discovery_source` text,
	`discovery_query` text,
	`research_status` text DEFAULT 'discovered' NOT NULL,
	`qualification_status` text DEFAULT 'unqualified' NOT NULL,
	`icp_fit_score` integer,
	`qualification_reason` text,
	`promoted_lead_id` text,
	`last_researched_at` integer,
	`qualified_at` integer,
	`promoted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outreach_prospects_business_status_idx` ON `outreach_prospects` (`business_id`,`qualification_status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `outreach_prospects_business_research_idx` ON `outreach_prospects` (`business_id`,`research_status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `outreach_prospects_business_employee_idx` ON `outreach_prospects` (`business_id`,`employee_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `outreach_prospects_business_domain_idx` ON `outreach_prospects` (`business_id`,`normalized_domain`);--> statement-breakpoint
CREATE INDEX `outreach_prospects_business_name_idx` ON `outreach_prospects` (`business_id`,`normalized_company_name`);--> statement-breakpoint
CREATE TABLE `outreach_research_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`prospect_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`finding_type` text NOT NULL,
	`claim` text NOT NULL,
	`classification` text DEFAULT 'unknown' NOT NULL,
	`source_url` text,
	`source_domain` text,
	`source_title` text,
	`source_tier` integer,
	`source_type` text,
	`buying_signal_type` text,
	`buying_signal_strength` text,
	`observed_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outreach_evidence_business_prospect_idx` ON `outreach_research_evidence` (`business_id`,`prospect_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `outreach_evidence_business_classification_idx` ON `outreach_research_evidence` (`business_id`,`classification`,`created_at`);--> statement-breakpoint
CREATE INDEX `outreach_evidence_business_signal_idx` ON `outreach_research_evidence` (`business_id`,`buying_signal_type`,`created_at`);