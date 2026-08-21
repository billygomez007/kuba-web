import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
  .notNull()
  .default(false),

  phone: text("phone"),
  phoneVerified: integer("phone_verified", { mode: "boolean" })
    .notNull()
    .default(false),

  image: text("image"),
  platformRole: text("platform_role").notNull().default("user"),

  platformScope: text("platform_scope"),

  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});



export const platformManagers = sqliteTable("platform_managers", {
  id: text("id").primaryKey(),

  userId: text("user_id").notNull(),

  role: text("role")
    .notNull()
    .default("platform_manager"),

  country: text("country"),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});



export const platformManagerAssignments = sqliteTable("platform_manager_assignments", {
  id: text("id").primaryKey(),

  platformManagerId: text("platform_manager_id").notNull(),

  businessId: text("business_id").notNull(),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
});

export const businesses = sqliteTable("businesses", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  industry: text("industry"),
  website: text("website"),
  country: text("country"),
  businessSize: text("business_size"),
  logoUrl: text("logo_url"),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Platform-managed catalog. Businesses never write these records directly.
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  monthlyPriceCents: integer("monthly_price_cents"),
  annualPriceCents: integer("annual_price_cents"),
  limits: text("limits"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Provider-neutral subscription state. Payment-provider identifiers are optional
// until a billing integration is explicitly introduced.
export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull().default("trialing"),
  billingInterval: text("billing_interval"),
  provider: text("provider"),
  providerSubscriptionId: text("provider_subscription_id"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  currentPeriodEndsAt: integer("current_period_ends_at", { mode: "timestamp" }),
  cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("subscriptions_business_status_idx").on(table.businessId, table.status),
  index("subscriptions_plan_status_idx").on(table.planId, table.status),
]);

// Append-only usage facts for future metering; aggregation and billing remain out
// of scope for this foundation.
export const usageRecords = sqliteTable("usage_records", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  metric: text("metric").notNull(),
  quantity: integer("quantity").notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("usage_records_business_metric_occurred_idx").on(table.businessId, table.metric, table.occurredAt),
]);

// Platform-wide audit events are deliberately separate from business audit logs.
export const platformAuditLogs = sqliteTable("platform_audit_logs", {
  id: text("id").primaryKey(),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  result: text("result").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("platform_audit_logs_actor_created_idx").on(table.actorUserId, table.createdAt),
  index("platform_audit_logs_target_created_idx").on(table.targetType, table.targetId, table.createdAt),
]);
export const branches = sqliteTable("branches", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  name: text("name").notNull(),

  location: text("location"),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: integer("created_at", {
    mode: "timestamp",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp",
  }).notNull(),
}, (table) => [index("branches_business_status_idx").on(table.businessId, table.status)]);

export const aiBusinessSettings = sqliteTable(
  "ai_business_settings",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull().unique(),

    businessDescription: text("business_description"),

    productsAndServices: text("products_and_services"),

    targetCustomers: text("target_customers"),

    frequentlyAskedQuestions: text(
      "frequently_asked_questions",
    ),

    aiInstructions: text("ai_instructions"),

    tone: text("tone").default("professional"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
);

export const knowledgeChunks = sqliteTable(
  "knowledge_chunks",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    sourceId: text("source_id").notNull(),

    chunkIndex: integer("chunk_index").notNull(),

    content: text("content").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("knowledge_chunks_business_source_idx").on(table.businessId, table.sourceId)],
);

export const businessUsers = sqliteTable("business_users", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  branchId: text("branch_id"),

  userId: text("user_id").notNull(),

  role: text("role").notNull().default("member"),

  permissions: text("permissions"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("business_users_user_idx").on(table.userId),
  index("business_users_business_idx").on(table.businessId),
]);



export const businessTeams = sqliteTable(
  "business_teams",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    department: text("department").notNull(),

    name: text("name").notNull(),

    description: text("description"),

    status: text("status").notNull().default("active"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("business_teams_business_status_idx").on(table.businessId, table.status)],
);

export const businessTeamMembers = sqliteTable(
  "business_team_members",
  {
    id: text("id").primaryKey(),

    teamId: text("team_id").notNull(),

    businessUserId: text("business_user_id").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
);

export const aiEmployeeTeams = sqliteTable(
  "ai_employee_teams",
  {
    id: text("id").primaryKey(),

    aiEmployeeId: text("ai_employee_id").notNull(),

    teamId: text("team_id").notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
);


export const conversationRouting = sqliteTable(
  "conversation_routing",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    conversationId: text("conversation_id").notNull(),

    department: text("department").notNull(),

    teamId: text("team_id"),

    aiEmployeeId: text("ai_employee_id"),

    assignedUserId: text("assigned_user_id"),

    assignmentType: text("assignment_type")
      .notNull()
      .default("ai"),

    status: text("status")
      .notNull()
      .default("ai_handling"),

    priority: text("priority")
      .notNull()
      .default("normal"),

    confidence: integer("confidence")
      .notNull()
      .default(0),

    routingReason: text("routing_reason"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    index("conversation_routing_business_status_idx").on(table.businessId, table.status),
    index("conversation_routing_conversation_idx").on(table.conversationId),
  ],
);


export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    userId: text("user_id"),

    action: text("action").notNull(),

    resource: text("resource").notNull(),

    resourceId: text("resource_id"),

    description: text("description"),

    metadata: text("metadata"),

    ipAddress: text("ip_address"),

    userAgent: text("user_agent"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("audit_logs_business_created_idx").on(table.businessId, table.createdAt)],
);

export const businessInvitations = sqliteTable(
  "business_invitations",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    email: text("email").notNull(),

    name: text("name"),

    role: text("role").notNull().default("member"),

    permissions: text("permissions"),

    branchId: text("branch_id"),

    token: text("token").notNull().unique(),

    invitedByUserId: text("invited_by_user_id").notNull(),

    status: text("status")
      .notNull()
      .default("pending"),

    expiresAt: integer("expires_at", {
      mode: "timestamp",
    }).notNull(),

    acceptedAt: integer("accepted_at", {
      mode: "timestamp",
    }),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
);

export const aiEmployeeTemplates = sqliteTable("ai_employee_templates", {
  id: text("id").primaryKey(),

  name: text("name").notNull(),

  type: text("type").notNull(),

  description: text("description"),

  version: text("version")
    .notNull()
    .default("1.0"),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});

export const aiEmployees = sqliteTable("ai_employees", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),

  branchId: text("branch_id"),

  templateId: text("template_id"),

  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),

  supervisionMode: text("supervision_mode")
    .notNull()
    .default("owner_supervised"),

  supervisorUserId: text("supervisor_user_id"),

  status: text("status").notNull().default("active"),

  mastraAgentId: text("mastra_agent_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("ai_employees_business_status_idx").on(table.businessId, table.status)]);
export const aiEmployeeSettings = sqliteTable(
  "ai_employee_settings",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id").notNull().unique(),

    roleInstructions: text("role_instructions"),

    goals: text("goals"),

    responsibilities: text("responsibilities"),

    personality: text("personality"),

    communicationStyle: text(
      "communication_style",
    ),

    informationToCollect: text(
      "information_to_collect",
    ),

    escalationRules: text(
      "escalation_rules",
    ),

    handoffRules: text(
      "handoff_rules",
    ),

    workingHours: text(
      "working_hours",
    ),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
);

export const customers = sqliteTable("customers", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  name: text("name"),

  email: text("email"),

  phone: text("phone"),

  source: text("source"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [index("customers_business_created_idx").on(table.businessId, table.createdAt)]);



export const customerTags = sqliteTable("customer_tags", {

  id: text("id").primaryKey(),

  customerId: text("customer_id").notNull(),

  tag: text("tag").notNull(),

  createdAt: integer("created_at", {
    mode:"timestamp_ms",
  }).notNull(),

});

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  customerId: text("customer_id"),

  name: text("name"),

  email: text("email"),

  phone: text("phone"),

  service: text("service"),

  destination: text("destination"),

  intent: text("intent"),

  notes: text("notes"),

  studyLevel: text("study_level"),
  program: text("program"),
  university: text("university"),
  preferredIntake: text("preferred_intake"),
  budget: text("budget"),

  source: text("source"),

  stage: text("stage")
    .notNull()
    .default("new"),

  estimatedValue: text("estimated_value"),

  currency: text("currency")
    .default("GHS"),

  dealStatus: text("deal_status")
    .default("open"),

  closedAt: integer("closed_at", {
    mode: "timestamp_ms",
  }),

  assignedEmployeeId: text("assigned_employee_id"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [
  index("leads_business_stage_updated_idx").on(table.businessId, table.stage, table.updatedAt),
  index("leads_business_customer_idx").on(table.businessId, table.customerId),
]);
export const followUps = sqliteTable("follow_ups", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  leadId: text("lead_id").notNull(),

  assignedEmployeeId: text("assigned_employee_id"),

  title: text("title").notNull(),

  description: text("description"),

  dueAt: integer("due_at", {
    mode: "timestamp_ms",
  }).notNull(),

  status: text("status")
    .notNull()
    .default("pending"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [
  index("follow_ups_business_status_due_idx").on(table.businessId, table.status, table.dueAt),
  index("follow_ups_business_lead_idx").on(table.businessId, table.leadId),
]);
export const salesActivities = sqliteTable("sales_activities", {
    
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  leadId: text("lead_id").notNull(),

  employeeId: text("employee_id"),

  type: text("type").notNull(),

  title: text("title").notNull(),

  description: text("description"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
});
export const integrations = sqliteTable("integrations", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  provider: text("provider").notNull(),

  status: text("status").notNull().default("active"),

  externalAccountId: text("external_account_id"),

  publicKey: text("public_key").unique(),


  externalPhoneNumberId: text("external_phone_number_id"),

  displayName: text("display_name"),

  credentialsEncrypted: text("credentials_encrypted"),

  metadata: text("metadata"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [index("integrations_business_provider_idx").on(table.businessId, table.provider)]);



export const aiEmployeeActivities = sqliteTable("ai_employee_activities", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  employeeId: text("employee_id").notNull(),

  type: text("type").notNull(),

  title: text("title").notNull(),

  description: text("description"),

  status: text("status")
    .notNull()
    .default("completed"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [index("ai_employee_activities_business_employee_created_idx").on(table.businessId, table.employeeId, table.createdAt)]);

export const automations = sqliteTable("automations", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  name: text("name").notNull(),

  description: text("description"),

  trigger: text("trigger").notNull(),

  conditions: text("conditions"),

  actions: text("actions").notNull(),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});


export const automationRuns = sqliteTable("automation_runs", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  automationId: text("automation_id").notNull(),

  triggerType: text("trigger_type").notNull(),

  triggerData: text("trigger_data"),

  status: text("status")
    .notNull()
    .default("running"),

  error: text("error"),

  startedAt: integer("started_at", {
    mode: "timestamp_ms",
  }).notNull(),

  completedAt: integer("completed_at", {
    mode: "timestamp_ms",
  }),
});



export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  title: text("title").notNull(),

  description: text("description"),

  status: text("status")
    .notNull()
    .default("pending"),

  priority: text("priority")
    .notNull()
    .default("normal"),

  assignedUserId: text("assigned_user_id"),

  assignedEmployeeId: text("assigned_employee_id"),

  leadId: text("lead_id"),

  customerId: text("customer_id"),

  automationId: text("automation_id"),

  dueAt: integer("due_at", {
    mode: "timestamp_ms",
  }),

  completedAt: integer("completed_at", {
    mode: "timestamp_ms",
  }),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [index("tasks_business_status_due_idx").on(table.businessId, table.status, table.dueAt)]);


export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),
    customerId: text("customer_id"),

  integrationId: text("integration_id").notNull(),

  externalConversationId: text("external_conversation_id"),

  customerName: text("customer_name"),

  customerPhone: text("customer_phone"),

  customerEmail: text("customer_email"),

  assignedEmployeeId: text("assigned_employee_id"),

  aiMode: text("ai_mode")
    .notNull()
    .default("active"),

  status: text("status").notNull().default("open"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [
  index("conversations_business_status_updated_idx").on(table.businessId, table.status, table.updatedAt),
  index("conversations_business_customer_idx").on(table.businessId, table.customerId),
]);



export const handoffs = sqliteTable("handoffs", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  conversationId: text("conversation_id").notNull(),

  fromEmployeeId: text("from_employee_id"),

  toUserId: text("to_user_id"),

  reason: text("reason").notNull(),

  status: text("status")
    .notNull()
    .default("pending"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp_ms",
  }).notNull(),
});

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  conversationId: text("conversation_id").notNull(),

  integrationId: text("integration_id").notNull(),

  externalMessageId: text("external_message_id"),

  direction: text("direction").notNull(),

  senderType: text("sender_type").notNull(),

  senderId: text("sender_id"),

  content: text("content").notNull(),

  messageType: text("message_type").notNull().default("text"),

  createdAt: integer("created_at", {
    mode: "timestamp_ms",
  }).notNull(),
}, (table) => [index("messages_business_conversation_created_idx").on(table.businessId, table.conversationId, table.createdAt)]);

export const businessLocalization = sqliteTable(
  "business_localization",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id")
      .notNull()
      .unique(),

    country: text("country"),

    currency: text("currency"),

    currencyCode: text("currency_code"),

    language: text("language")
      .default("en"),

    timezone: text("timezone")
      .default("Africa/Accra"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
);

export const businessModules = sqliteTable(
  "business_modules",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    moduleKey: text("module_key").notNull(),
    status: text("status").notNull().default("active"),
    activatedAt: integer("activated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("business_modules_business_module_uidx").on(
      table.businessId,
      table.moduleKey,
    ),
    index("business_modules_business_idx").on(table.businessId),
    index("business_modules_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  ],
);

export const approvalRequests = sqliteTable(
  "approval_requests",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    approvalType: text("approval_type").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    requestedByType: text("requested_by_type").notNull(),
    requestedByUserId: text("requested_by_user_id"),
    requestedByAiEmployeeId: text("requested_by_ai_employee_id"),
    title: text("title").notNull(),
    description: text("description"),
    payload: text("payload").notNull(),
    requiredPermission: text("required_permission").notNull(),
    status: text("status").notNull().default("pending"),
    priority: text("priority").notNull().default("normal"),
    currentStep: integer("current_step").notNull().default(1),
    totalSteps: integer("total_steps").notNull().default(1),
    idempotencyKey: text("idempotency_key"),
    legacyActionApprovalId: text("legacy_action_approval_id"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("approval_requests_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
    index("approval_requests_business_type_status_idx").on(
      table.businessId,
      table.approvalType,
      table.status,
    ),
    index("approval_requests_business_resource_idx").on(
      table.businessId,
      table.resourceType,
      table.resourceId,
    ),
    index("approval_requests_business_requester_idx").on(
      table.businessId,
      table.requestedByUserId,
      table.createdAt,
    ),
    uniqueIndex("approval_requests_business_idempotency_uidx").on(
      table.businessId,
      table.idempotencyKey,
    ),
    uniqueIndex("approval_requests_legacy_action_uidx").on(
      table.legacyActionApprovalId,
    ),
  ],
);

export const approvalSteps = sqliteTable(
  "approval_steps",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    approvalRequestId: text("approval_request_id").notNull(),
    stepNumber: integer("step_number").notNull(),
    approverUserId: text("approver_user_id"),
    requiredRole: text("required_role"),
    requiredPermission: text("required_permission").notNull(),
    status: text("status").notNull().default("pending"),
    decision: text("decision"),
    decisionNote: text("decision_note"),
    decidedByUserId: text("decided_by_user_id"),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("approval_steps_request_step_uidx").on(
      table.businessId,
      table.approvalRequestId,
      table.stepNumber,
    ),
    index("approval_steps_business_status_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
    index("approval_steps_business_approver_status_idx").on(
      table.businessId,
      table.approverUserId,
      table.status,
    ),
  ],
);

export const approvalEvents = sqliteTable(
  "approval_events",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    approvalRequestId: text("approval_request_id").notNull(),
    approvalStepId: text("approval_step_id"),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    actorAiEmployeeId: text("actor_ai_employee_id"),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("approval_events_business_request_created_idx").on(
      table.businessId,
      table.approvalRequestId,
      table.createdAt,
    ),
    index("approval_events_business_actor_created_idx").on(
      table.businessId,
      table.actorUserId,
      table.createdAt,
    ),
  ],
);

export const notificationTemplates = sqliteTable(
  "notification_templates",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    templateKey: text("template_key").notNull(),
    channel: text("channel").notNull(),
    locale: text("locale").notNull().default("en"),
    name: text("name").notNull(),
    subjectTemplate: text("subject_template"),
    bodyTemplate: text("body_template").notNull(),
    allowedVariables: text("allowed_variables"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("notification_templates_business_key_channel_locale_uidx").on(
      table.businessId,
      table.templateKey,
      table.channel,
      table.locale,
    ),
    index("notification_templates_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  ],
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    recipientUserId: text("recipient_user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),
    actionUrl: text("action_url"),
    priority: text("priority").notNull().default("normal"),
    metadata: text("metadata"),
    readAt: integer("read_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("notifications_business_recipient_read_idx").on(
      table.businessId,
      table.recipientUserId,
      table.readAt,
      table.createdAt,
    ),
    index("notifications_business_recipient_created_idx").on(
      table.businessId,
      table.recipientUserId,
      table.createdAt,
    ),
    index("notifications_business_resource_idx").on(
      table.businessId,
      table.resourceType,
      table.resourceId,
    ),
  ],
);

export const notificationDeliveries = sqliteTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    notificationId: text("notification_id").notNull(),
    templateId: text("template_id"),
    channel: text("channel").notNull(),
    recipient: text("recipient").notNull(),
    status: text("status").notNull().default("pending"),
    attemptCount: integer("attempt_count").notNull().default(0),
    provider: text("provider"),
    providerMessageId: text("provider_message_id"),
    idempotencyKey: text("idempotency_key"),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp" }),
    sentAt: integer("sent_at", { mode: "timestamp" }),
    deliveredAt: integer("delivered_at", { mode: "timestamp" }),
    failedAt: integer("failed_at", { mode: "timestamp" }),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("notification_deliveries_business_status_scheduled_idx").on(
      table.businessId,
      table.status,
      table.scheduledAt,
    ),
    index("notification_deliveries_business_notification_idx").on(
      table.businessId,
      table.notificationId,
    ),
    uniqueIndex("notification_deliveries_business_idempotency_uidx").on(
      table.businessId,
      table.idempotencyKey,
    ),
    index("notification_deliveries_business_provider_message_idx").on(
      table.businessId,
      table.provider,
      table.providerMessageId,
    ),
  ],
);

export const aiEmployeeScopes = sqliteTable(
  "ai_employee_scopes",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    aiEmployeeId: text("ai_employee_id").notNull(),
    scope: text("scope").notNull(),
    effect: text("effect").notNull().default("allow"),
    status: text("status").notNull().default("active"),
    grantedByUserId: text("granted_by_user_id").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("ai_employee_scopes_business_employee_scope_uidx").on(
      table.businessId,
      table.aiEmployeeId,
      table.scope,
    ),
    index("ai_employee_scopes_business_scope_status_idx").on(
      table.businessId,
      table.scope,
      table.status,
    ),
    index("ai_employee_scopes_business_employee_status_idx").on(
      table.businessId,
      table.aiEmployeeId,
      table.status,
    ),
  ],
);

export const actionApprovals = sqliteTable("action_approvals", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  employeeId: text("employee_id"),
  channel: text("channel").notNull(),
  recipient: text("recipient").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("action_approvals_business_status_created_idx").on(table.businessId, table.status, table.createdAt)]);

export const communicationLogs = sqliteTable("communication_logs", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  employeeId: text("employee_id"),

  customerId: text("customer_id"),

  leadId: text("lead_id"),

  channel: text("channel").notNull(),

  recipient: text("recipient").notNull(),

  message: text("message").notNull(),

  status: text("status")
    .notNull()
    .default("pending"),

  provider: text("provider"),

  providerMessageId: text("provider_message_id"),

  createdAt: integer("created_at", {
    mode: "timestamp",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp",
  }).notNull(),
});

export const channelConnections = sqliteTable("channel_connections", {

  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  channel: text("channel").notNull(),

  accountName: text("account_name"),

  accountId: text("account_id"),

  accessToken: text("access_token"),

  status: text("status")
    .notNull()
    .default("active"),

  createdAt: integer("created_at", {
    mode: "timestamp",
  }).notNull(),

  updatedAt: integer("updated_at", {
    mode: "timestamp",
  }).notNull(),

});

export const knowledgeSources = sqliteTable(
  "knowledge_sources",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id")
      .notNull(),

    employeeId: text("employee_id"),

    name: text("name").notNull(),

    originalName: text("original_name")
      .notNull(),

    fileType: text("file_type")
      .notNull(),

    mimeType: text("mime_type"),

    fileSize: integer("file_size"),

    storageKey: text("storage_key")
      .notNull(),

    status: text("status")
      .notNull()
      .default("processing"),

    processingError: text("processing_error"),

    description: text("description"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("knowledge_sources_business_status_idx").on(table.businessId, table.status)],
);

export const skills = sqliteTable(
  "skills",
  {
    id: text("id").primaryKey(),

    name: text("name")
      .notNull(),

    slug: text("slug")
      .notNull()
      .unique(),

    description: text("description"),

    category: text("category")
      .notNull(),

    type: text("type")
      .notNull()
      .default("kuba_official"),

    version: text("version")
      .notNull()
      .default("1.0"),

    instructions: text("instructions"),

    tools: text("tools"),

    status: text("status")
      .notNull()
      .default("active"),

    publisher: text("publisher")
      .notNull()
      .default("Kuba"),

    icon: text("icon"),

    isMarketplace: integer("is_marketplace", {
      mode: "boolean",
    })
      .notNull()
      .default(true),

    price: integer("price")
      .notNull()
      .default(0),

    rating: integer("rating")
      .notNull()
      .default(5),

    installCount: integer("install_count")
      .notNull()
      .default(0),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
);


export const employeeSkills = sqliteTable(
  "employee_skills",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, {
        onDelete: "cascade",
      }),

    status: text("status")
      .notNull()
      .default("active"),

    installedAt: integer("installed_at", {
      mode: "timestamp",
    }).notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [
    index("employeeSkills_employeeId_idx")
      .on(table.employeeId),

    index("employeeSkills_skillId_idx")
      .on(table.skillId),
  ],
);


export const websiteWidgets = sqliteTable(
  "website_widgets",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id")
      .notNull(),

    name: text("name")
      .notNull(),

    websiteUrl: text("website_url"),

    employeeId: text("employee_id"),

    publicKey: text("public_key")
      .notNull()
      .unique(),

    status: text("status")
      .notNull()
      .default("active"),

    welcomeMessage: text("welcome_message"),

    position: text("position")
      .notNull()
      .default("bottom-right"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("website_widgets_business_status_idx").on(table.businessId, table.status)],
);



export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),

    businessId: text("business_id").notNull(),

    customerId: text("customer_id"),

    title: text("title").notNull(),

    description: text("description"),

    status: text("status")
      .notNull()
      .default("open"),

    priority: text("priority")
      .notNull()
      .default("medium"),

    category: text("category"),

    assignedEmployeeId: text("assigned_employee_id"),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),

    updatedAt: integer("updated_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("tickets_business_status_updated_idx").on(table.businessId, table.status, table.updatedAt)],
);


export const ticketMessages = sqliteTable(
  "ticket_messages",
  {
    id: text("id").primaryKey(),

    ticketId: text("ticket_id").notNull(),

    senderType: text("sender_type")
      .notNull(),

    message: text("message")
      .notNull(),

    createdAt: integer("created_at", {
      mode: "timestamp",
    }).notNull(),
  },
  (table) => [index("ticket_messages_ticket_created_idx").on(table.ticketId, table.createdAt)],
);

export const hrDepartments = sqliteTable(
  "hr_departments",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentDepartmentId: text("parent_department_id"),
    managerEmployeeId: text("manager_employee_id"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_departments_business_code_uidx").on(
      table.businessId,
      table.code,
    ),
    index("hr_departments_business_status_idx").on(
      table.businessId,
      table.status,
    ),
    index("hr_departments_business_parent_idx").on(
      table.businessId,
      table.parentDepartmentId,
    ),
    index("hr_departments_business_manager_idx").on(
      table.businessId,
      table.managerEmployeeId,
    ),
  ],
);

export const hrPositions = sqliteTable(
  "hr_positions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    departmentId: text("department_id"),
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    grade: text("grade"),
    employmentType: text("employment_type"),
    reportsToPositionId: text("reports_to_position_id"),
    headcountLimit: integer("headcount_limit"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_positions_business_code_uidx").on(
      table.businessId,
      table.code,
    ),
    index("hr_positions_business_department_status_idx").on(
      table.businessId,
      table.departmentId,
      table.status,
    ),
    index("hr_positions_business_reports_to_idx").on(
      table.businessId,
      table.reportsToPositionId,
    ),
    index("hr_positions_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  ],
);

export const hrEmployees = sqliteTable(
  "hr_employees",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    businessUserId: text("business_user_id"),
    employeeNumber: text("employee_number").notNull(),
    displayName: text("display_name").notNull(),
    departmentId: text("department_id"),
    positionId: text("position_id"),
    managerEmployeeId: text("manager_employee_id"),
    branchId: text("branch_id"),
    workEmail: text("work_email"),
    workPhone: text("work_phone"),
    hireDate: integer("hire_date", { mode: "timestamp" }).notNull(),
    employmentType: text("employment_type").notNull(),
    employmentStatus: text("employment_status").notNull().default("active"),
    terminationDate: integer("termination_date", { mode: "timestamp" }),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_employees_business_number_uidx").on(
      table.businessId,
      table.employeeNumber,
    ),
    uniqueIndex("hr_employees_business_user_uidx").on(
      table.businessId,
      table.businessUserId,
    ),
    index("hr_employees_business_status_idx").on(
      table.businessId,
      table.employmentStatus,
    ),
    index("hr_employees_business_department_status_idx").on(
      table.businessId,
      table.departmentId,
      table.employmentStatus,
    ),
    index("hr_employees_business_position_idx").on(
      table.businessId,
      table.positionId,
    ),
    index("hr_employees_business_manager_idx").on(
      table.businessId,
      table.managerEmployeeId,
    ),
    index("hr_employees_business_branch_idx").on(
      table.businessId,
      table.branchId,
    ),
  ],
);

export const hrEmployeeProfiles = sqliteTable(
  "hr_employee_profiles",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    legalFirstName: text("legal_first_name").notNull(),
    legalMiddleName: text("legal_middle_name"),
    legalLastName: text("legal_last_name").notNull(),
    preferredName: text("preferred_name"),
    dateOfBirth: integer("date_of_birth", { mode: "timestamp" }),
    gender: text("gender"),
    nationality: text("nationality"),
    personalEmail: text("personal_email"),
    personalPhone: text("personal_phone"),
    address: text("address"),
    emergencyContactName: text("emergency_contact_name"),
    emergencyContactRelationship: text("emergency_contact_relationship"),
    emergencyContactPhone: text("emergency_contact_phone"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_employee_profiles_business_employee_uidx").on(
      table.businessId,
      table.employeeId,
    ),
    index("hr_employee_profiles_business_name_idx").on(
      table.businessId,
      table.legalLastName,
      table.legalFirstName,
    ),
  ],
);

export const hrContracts = sqliteTable(
  "hr_contracts",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    positionId: text("position_id"),
    contractNumber: text("contract_number").notNull(),
    contractType: text("contract_type").notNull(),
    status: text("status").notNull().default("draft"),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }),
    probationEndDate: integer("probation_end_date", { mode: "timestamp" }),
    workLocation: text("work_location"),
    hoursPerWeek: integer("hours_per_week"),
    termsSummary: text("terms_summary"),
    approvalRequestId: text("approval_request_id"),
    signedAt: integer("signed_at", { mode: "timestamp" }),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_contracts_business_number_uidx").on(
      table.businessId,
      table.contractNumber,
    ),
    index("hr_contracts_business_employee_status_idx").on(
      table.businessId,
      table.employeeId,
      table.status,
    ),
    index("hr_contracts_business_status_end_idx").on(
      table.businessId,
      table.status,
      table.endDate,
    ),
    index("hr_contracts_business_approval_idx").on(
      table.businessId,
      table.approvalRequestId,
    ),
    index("hr_contracts_business_position_idx").on(
      table.businessId,
      table.positionId,
    ),
  ],
);

export const hrEmployeeDocuments = sqliteTable(
  "hr_employee_documents",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    contractId: text("contract_id"),
    documentType: text("document_type").notNull(),
    title: text("title").notNull(),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    visibility: text("visibility").notNull().default("hr_only"),
    status: text("status").notNull().default("active"),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    uploadedByUserId: text("uploaded_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_employee_documents_business_storage_uidx").on(
      table.businessId,
      table.storageKey,
    ),
    index("hr_employee_documents_business_employee_type_idx").on(
      table.businessId,
      table.employeeId,
      table.documentType,
    ),
    index("hr_employee_documents_business_contract_idx").on(
      table.businessId,
      table.contractId,
    ),
    index("hr_employee_documents_business_status_expiry_idx").on(
      table.businessId,
      table.status,
      table.expiresAt,
    ),
  ],
);

export const hrEmploymentStatusHistory = sqliteTable(
  "hr_employment_status_history",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status").notNull(),
    reason: text("reason"),
    effectiveAt: integer("effective_at", { mode: "timestamp" }).notNull(),
    changedByUserId: text("changed_by_user_id").notNull(),
    approvalRequestId: text("approval_request_id"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("hr_employment_status_history_business_employee_effective_idx").on(
      table.businessId,
      table.employeeId,
      table.effectiveAt,
    ),
    index("hr_employment_status_history_business_status_effective_idx").on(
      table.businessId,
      table.newStatus,
      table.effectiveAt,
    ),
    index("hr_employment_status_history_business_approval_idx").on(
      table.businessId,
      table.approvalRequestId,
    ),
  ],
);
