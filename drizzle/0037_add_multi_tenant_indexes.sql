CREATE INDEX IF NOT EXISTS `branches_business_status_idx` ON `branches` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `knowledge_chunks_business_source_idx` ON `knowledge_chunks` (`business_id`, `source_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `business_users_user_idx` ON `business_users` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `business_users_business_idx` ON `business_users` (`business_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `business_teams_business_status_idx` ON `business_teams` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `conversation_routing_business_status_idx` ON `conversation_routing` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `conversation_routing_conversation_idx` ON `conversation_routing` (`conversation_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_logs_business_created_idx` ON `audit_logs` (`business_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_employees_business_status_idx` ON `ai_employees` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `customers_business_created_idx` ON `customers` (`business_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_business_stage_updated_idx` ON `leads` (`business_id`, `stage`, `updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `leads_business_customer_idx` ON `leads` (`business_id`, `customer_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `follow_ups_business_status_due_idx` ON `follow_ups` (`business_id`, `status`, `due_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `follow_ups_business_lead_idx` ON `follow_ups` (`business_id`, `lead_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `integrations_business_provider_idx` ON `integrations` (`business_id`, `provider`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ai_employee_activities_business_employee_created_idx` ON `ai_employee_activities` (`business_id`, `employee_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tasks_business_status_due_idx` ON `tasks` (`business_id`, `status`, `due_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `conversations_business_status_updated_idx` ON `conversations` (`business_id`, `status`, `updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `conversations_business_customer_idx` ON `conversations` (`business_id`, `customer_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `messages_business_conversation_created_idx` ON `messages` (`business_id`, `conversation_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `action_approvals_business_status_created_idx` ON `action_approvals` (`business_id`, `status`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `knowledge_sources_business_status_idx` ON `knowledge_sources` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `website_widgets_business_status_idx` ON `website_widgets` (`business_id`, `status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `tickets_business_status_updated_idx` ON `tickets` (`business_id`, `status`, `updated_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ticket_messages_ticket_created_idx` ON `ticket_messages` (`ticket_id`, `created_at`);
