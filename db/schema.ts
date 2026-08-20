import {
  integer,
  sqliteTable,
  text,
  index,
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
});

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
);

export const businessUsers = sqliteTable("business_users", {
  id: text("id").primaryKey(),

  businessId: text("business_id").notNull(),

  branchId: text("branch_id"),

  userId: text("user_id").notNull(),

  role: text("role").notNull().default("member"),

  permissions: text("permissions"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});



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
});
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
});



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
});
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
});
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
});



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
});

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
});


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
});



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
});

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
});

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
);
