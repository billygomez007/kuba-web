import { sqliteTable, AnySQLiteColumn, index, foreignKey, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core"
  import { sql } from "drizzle-orm"

export const account = sqliteTable("account", {
	id: text().primaryKey().notNull(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at"),
	refreshTokenExpiresAt: integer("refresh_token_expires_at"),
	scope: text(),
	password: text(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("account_userId_idx").on(table.userId),
]);

export const aiEmployees = sqliteTable("ai_employees", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text().notNull(),
	type: text().notNull(),
	description: text(),
	status: text().default("active").notNull(),
	mastraAgentId: text("mastra_agent_id"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	branchId: text("branch_id"),
	supervisionMode: text("supervision_mode").default("owner_supervised").notNull(),
	supervisorUserId: text("supervisor_user_id"),
	templateId: text("template_id"),
});

export const businessUsers = sqliteTable("business_users", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default("member").notNull(),
	createdAt: integer("created_at").notNull(),
	branchId: text("branch_id"),
	permissions: text(),
});

export const businesses = sqliteTable("businesses", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text().notNull(),
	industry: text(),
	logoUrl: text("logo_url"),
	plan: text().default("starter").notNull(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	country: text(),
	businessSize: text("business_size"),
	website: text(),
},
(table) => [
	uniqueIndex("businesses_slug_unique").on(table.slug),
]);

export const leads = sqliteTable("leads", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text(),
	email: text(),
	phone: text(),
	source: text(),
	stage: text().default("new").notNull(),
	assignedEmployeeId: text("assigned_employee_id"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	customerId: text("customer_id"),
	service: text(),
	destination: text(),
	intent: text(),
	notes: text(),
	studyLevel: text("study_level"),
	program: text(),
	university: text(),
	preferredIntake: text("preferred_intake"),
	budget: text(),
	estimatedValue: text("estimated_value"),
	currency: text().default("GHS"),
	dealStatus: text("deal_status").default("open"),
	closedAt: integer("closed_at"),
});

export const session = sqliteTable("session", {
	id: text().primaryKey().notNull(),
	expiresAt: integer("expires_at").notNull(),
	token: text().notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" } ),
},
(table) => [
	index("session_userId_idx").on(table.userId),
	uniqueIndex("session_token_unique").on(table.token),
]);

export const users = sqliteTable("users", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	email: text().notNull(),
	emailVerified: integer("email_verified").default(0).notNull(),
	image: text(),
	platformRole: text("platform_role").default("user").notNull(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	platformScope: text("platform_scope"),
	phone: text(),
	phoneVerified: integer("phone_verified").default(0).notNull(),
},
(table) => [
	uniqueIndex("users_email_unique").on(table.email),
]);

export const verification = sqliteTable("verification", {
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	value: text().notNull(),
	expiresAt: integer("expires_at").notNull(),
	createdAt: integer("created_at").default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	index("verification_identifier_idx").on(table.identifier),
]);

export const followUps = sqliteTable("follow_ups", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	leadId: text("lead_id").notNull(),
	assignedEmployeeId: text("assigned_employee_id"),
	title: text().notNull(),
	description: text(),
	dueAt: integer("due_at").notNull(),
	status: text().default("pending").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const conversations = sqliteTable("conversations", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	integrationId: text("integration_id").notNull(),
	externalConversationId: text("external_conversation_id"),
	customerName: text("customer_name"),
	customerPhone: text("customer_phone"),
	customerEmail: text("customer_email"),
	assignedEmployeeId: text("assigned_employee_id"),
	status: text().default("open").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	customerId: text("customer_id"),
	aiMode: text("ai_mode").default("active").notNull(),
});

export const integrations = sqliteTable("integrations", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	provider: text().notNull(),
	status: text().default("active").notNull(),
	externalAccountId: text("external_account_id"),
	externalPhoneNumberId: text("external_phone_number_id"),
	displayName: text("display_name"),
	credentialsEncrypted: text("credentials_encrypted"),
	metadata: text(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const messages = sqliteTable("messages", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	conversationId: text("conversation_id").notNull(),
	integrationId: text("integration_id").notNull(),
	externalMessageId: text("external_message_id"),
	direction: text().notNull(),
	senderType: text("sender_type").notNull(),
	senderId: text("sender_id"),
	content: text().notNull(),
	messageType: text("message_type").default("text").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const salesActivities = sqliteTable("sales_activities", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	leadId: text("lead_id").notNull(),
	employeeId: text("employee_id"),
	type: text().notNull(),
	title: text().notNull(),
	description: text(),
	createdAt: integer("created_at").notNull(),
});

export const aiBusinessSettings = sqliteTable("ai_business_settings", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	businessDescription: text("business_description"),
	productsAndServices: text("products_and_services"),
	targetCustomers: text("target_customers"),
	frequentlyAskedQuestions: text("frequently_asked_questions"),
	aiInstructions: text("ai_instructions"),
	tone: text().default("professional"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("ai_business_settings_business_id_unique").on(table.businessId),
]);

export const aiEmployeeSettings = sqliteTable("ai_employee_settings", {
	id: text().primaryKey().notNull(),
	employeeId: text("employee_id").notNull(),
	roleInstructions: text("role_instructions"),
	goals: text(),
	responsibilities: text(),
	personality: text(),
	communicationStyle: text("communication_style"),
	informationToCollect: text("information_to_collect"),
	escalationRules: text("escalation_rules"),
	handoffRules: text("handoff_rules"),
	workingHours: text("working_hours"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("ai_employee_settings_employee_id_unique").on(table.employeeId),
]);

export const customers = sqliteTable("customers", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text(),
	email: text(),
	phone: text(),
	source: text(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const aiEmployeeTemplates = sqliteTable("ai_employee_templates", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	type: text().notNull(),
	description: text(),
	version: text().default("1.0").notNull(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const branches = sqliteTable("branches", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text().notNull(),
	location: text(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const handoffs = sqliteTable("handoffs", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	conversationId: text("conversation_id").notNull(),
	fromEmployeeId: text("from_employee_id"),
	toUserId: text("to_user_id"),
	reason: text().notNull(),
	status: text().default("pending").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const platformManagers = sqliteTable("platform_managers", {
	id: text().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	role: text().default("platform_manager").notNull(),
	country: text(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const platformManagerAssignments = sqliteTable("platform_manager_assignments", {
	id: text().primaryKey().notNull(),
	platformManagerId: text("platform_manager_id").notNull(),
	businessId: text("business_id").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const aiEmployeeActivities = sqliteTable("ai_employee_activities", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	employeeId: text("employee_id").notNull(),
	type: text().notNull(),
	title: text().notNull(),
	description: text(),
	status: text().default("completed").notNull(),
	createdAt: integer("created_at").notNull(),
});

export const businessLocalization = sqliteTable("business_localization", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	country: text(),
	currency: text(),
	currencyCode: text("currency_code"),
	language: text().default("en"),
	timezone: text().default("Africa/Accra"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
},
(table) => [
	uniqueIndex("business_localization_business_id_unique").on(table.businessId),
]);

export const actionApprovals = sqliteTable("action_approvals", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	employeeId: text("employee_id"),
	channel: text().notNull(),
	recipient: text().notNull(),
	message: text().notNull(),
	status: text().default("pending").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const communicationLogs = sqliteTable("communication_logs", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	employeeId: text("employee_id"),
	customerId: text("customer_id"),
	leadId: text("lead_id"),
	channel: text().notNull(),
	recipient: text().notNull(),
	message: text().notNull(),
	status: text().default("pending").notNull(),
	provider: text(),
	providerMessageId: text("provider_message_id"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const automationRuns = sqliteTable("automation_runs", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	automationId: text("automation_id").notNull(),
	triggerType: text("trigger_type").notNull(),
	triggerData: text("trigger_data"),
	status: text().default("running").notNull(),
	error: text(),
	startedAt: integer("started_at").notNull(),
	completedAt: integer("completed_at"),
});

export const automations = sqliteTable("automations", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text().notNull(),
	description: text(),
	trigger: text().notNull(),
	conditions: text(),
	actions: text().notNull(),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const channelConnections = sqliteTable("channel_connections", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	channel: text().notNull(),
	accountName: text("account_name"),
	accountId: text("account_id"),
	accessToken: text("access_token"),
	status: text().default("active").notNull(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

export const customerTags = sqliteTable("customer_tags", {
	id: text().primaryKey().notNull(),
	customerId: text("customer_id").notNull(),
	tag: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

export const knowledgeChunks = sqliteTable("knowledge_chunks", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	sourceId: text("source_id").notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	content: text().notNull(),
	createdAt: integer("created_at").notNull(),
});

export const knowledgeSources = sqliteTable("knowledge_sources", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	name: text().notNull(),
	originalName: text("original_name").notNull(),
	fileType: text("file_type").notNull(),
	mimeType: text("mime_type"),
	fileSize: integer("file_size"),
	storageKey: text("storage_key").notNull(),
	status: text().default("processing").notNull(),
	processingError: text("processing_error"),
	description: text(),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
	employeeId: text("employee_id"),
});

export const tasks = sqliteTable("tasks", {
	id: text().primaryKey().notNull(),
	businessId: text("business_id").notNull(),
	title: text().notNull(),
	description: text(),
	status: text().default("pending").notNull(),
	priority: text().default("normal").notNull(),
	assignedUserId: text("assigned_user_id"),
	assignedEmployeeId: text("assigned_employee_id"),
	leadId: text("lead_id"),
	customerId: text("customer_id"),
	automationId: text("automation_id"),
	dueAt: integer("due_at"),
	completedAt: integer("completed_at"),
	createdAt: integer("created_at").notNull(),
	updatedAt: integer("updated_at").notNull(),
});

