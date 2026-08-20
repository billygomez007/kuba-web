CREATE TABLE `knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`business_id` text NOT NULL,
	`name` text NOT NULL,
	`original_name` text NOT NULL,
	`file_type` text NOT NULL,
	`mime_type` text,
	`file_size` integer,
	`storage_key` text NOT NULL,
	`status` text DEFAULT 'processing' NOT NULL,
	`processing_error` text,
	`description` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
