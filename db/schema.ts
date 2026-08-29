import {
  integer,
  sqliteTable,
  text,
  index,
  uniqueIndex,
  check,
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

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull().unique(),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id").unique(),
  providerAuthorizationReference: text("provider_authorization_reference"),
  providerEventId: text("provider_event_id").unique(),
  // Human-readable payment method display only (e.g. "Visa •••• 4242") — never
  // raw card credentials. Persisted at authorization time since the provider does not
  // offer a simple way to re-fetch card display metadata later.
  paymentMethodSummary: text("payment_method_summary"),
  plan: text("plan").notNull().default("starter"),
  status: text("status").notNull().default("incomplete"),
  currentPeriodStart: integer("current_period_start", { mode: "timestamp_ms" }),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
  cancelAtPeriodEnd: integer("cancel_at_period_end", { mode: "boolean" }).notNull().default(false),
  trialEnd: integer("trial_end", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (table) => [uniqueIndex("subscriptions_business_id_unique").on(table.businessId)]);

export const entitlementOverrides = sqliteTable("entitlement_overrides", {
  id: text("id").primaryKey(),
  businessId: text("business_id").notNull(),
  feature: text("feature").notNull(),
  overrideType: text("override_type").notNull(),
  value: text("value").notNull(),
  reason: text("reason").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const partnerOrganizations = sqliteTable("partner_organizations", {
  id: text("id").primaryKey(), name: text("name").notNull(), contactEmail: text("contact_email").notNull(), website: text("website"), country: text("country"), description: text("description"), supportContact: text("support_contact"), verificationStatus: text("verification_status").notNull().default("draft"), marketplaceStatus: text("marketplace_status").notNull().default("draft"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
export const partnerProducts = sqliteTable("partner_products", { id: text("id").primaryKey(), partnerId: text("partner_id").notNull(), name: text("name").notNull(), type: text("type").notNull(), description: text("description").notNull(), status: text("status").notNull().default("draft"), verified: integer("verified", { mode: "boolean" }).notNull().default(false), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(), updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull() });
export const partnerProductVersions = sqliteTable("partner_product_versions", { id: text("id").primaryKey(), productId: text("product_id").notNull(), version: text("version").notNull(), releaseNotes: text("release_notes"), manifest: text("manifest").notNull(), status: text("status").notNull().default("draft"), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull() });
export const developerApiKeys = sqliteTable("developer_api_keys", { id: text("id").primaryKey(), partnerId: text("partner_id").notNull(), keyHash: text("key_hash").notNull().unique(), scopes: text("scopes").notNull(), revokedAt: integer("revoked_at", { mode: "timestamp_ms" }), lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }), createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull() });
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

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    customerId: text("customer_id"),
    leadId: text("lead_id"),
    conversationId: text("conversation_id"),
    branchId: text("branch_id"),
    assignedUserId: text("assigned_user_id"),
    assignedHumanEmployeeId: text("assigned_human_employee_id"),
    assignedAiEmployeeId: text("assigned_ai_employee_id"),
    startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
    endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
    timezone: text("timezone").notNull(),
    status: text("status").notNull().default("scheduled"),
    appointmentType: text("appointment_type").notNull().default("meeting"),
    meetingMode: text("meeting_mode").notNull().default("in_person"),
    location: text("location"),
    meetingUrl: text("meeting_url"),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    confirmedAt: integer("confirmed_at", { mode: "timestamp_ms" }),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    noShowAt: integer("no_show_at", { mode: "timestamp_ms" }),
    cancellationReason: text("cancellation_reason"),
  },
  (table) => [
    index("appointments_business_start_idx").on(table.businessId, table.startAt),
    index("appointments_business_status_start_idx").on(table.businessId, table.status, table.startAt),
    index("appointments_business_customer_idx").on(table.businessId, table.customerId),
    index("appointments_business_assigned_user_idx").on(table.businessId, table.assignedUserId, table.startAt),
    index("appointments_business_assigned_ai_idx").on(table.businessId, table.assignedAiEmployeeId, table.startAt),
  ],
);

export const tickets = sqliteTable(
  "tickets",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    ticketReference: text("ticket_reference").notNull().unique(),
    subject: text("subject").notNull(),
    description: text("description").notNull(),
    customerId: text("customer_id"),
    leadId: text("lead_id"),
    conversationId: text("conversation_id"),
    branchId: text("branch_id"),
    assignedUserId: text("assigned_user_id"),
    assignedHumanEmployeeId: text("assigned_human_employee_id"),
    assignedAiEmployeeId: text("assigned_ai_employee_id"),
    assignedTeamId: text("assigned_team_id"),
    status: text("status").notNull().default("open"),
    priority: text("priority").notNull().default("normal"),
    source: text("source").notNull().default("manual"),
    category: text("category"),
    resolutionSummary: text("resolution_summary"),
    openedAt: integer("opened_at", { mode: "timestamp_ms" }).notNull(),
    firstResponseAt: integer("first_response_at", { mode: "timestamp_ms" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    closedAt: integer("closed_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    index("tickets_business_status_priority_idx").on(table.businessId, table.status, table.priority, table.updatedAt),
    index("tickets_business_customer_idx").on(table.businessId, table.customerId),
    index("tickets_business_assignee_idx").on(table.businessId, table.assignedUserId, table.updatedAt),
    index("tickets_business_conversation_idx").on(table.businessId, table.conversationId),
  ],
);
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

  // Truthful connection-health signal for the Integrations UI — the last
  // time this integration received a verified provider webhook. Never
  // fabricated; null simply means no webhook has arrived yet.
  lastWebhookAt: integer("last_webhook_at", {
    mode: "timestamp_ms",
  }),

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

  voiceProvider: text("voice_provider"),

  voiceDirection: text("voice_direction"),

  voiceStartedAt: integer("voice_started_at", { mode: "timestamp_ms" }),

  voiceConnectedAt: integer("voice_connected_at", { mode: "timestamp_ms" }),

  voiceEndedAt: integer("voice_ended_at", { mode: "timestamp_ms" }),

  voiceDurationSeconds: integer("voice_duration_seconds"),

  voiceBillableMinutes: integer("voice_billable_minutes"),

  voiceRecordingUrl: text("voice_recording_url"),

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

  // Provider delivery lifecycle for outbound messages (e.g. WhatsApp
  // "sent"/"delivered"/"read"/"failed" status callbacks). Null until a
  // provider status webhook updates it; inbound messages never set this.
  status: text("status"),

  statusUpdatedAt: integer("status_updated_at", {
    mode: "timestamp_ms",
  }),

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

/**
 * HR core, attendance/leave, and payroll tables.
 *
 * These tables already exist in the deployed database but were missing
 * from this file. The HR core and attendance/leave definitions below are
 * recovered verbatim (column-for-column and index-for-index verified
 * against the live schema) from a locally-recovered historical version of
 * this file. The payroll definitions have no recovered source; they are
 * generated directly from the live database's column types, defaults,
 * nullability, indexes, and check constraints. No columns, indexes, or
 * foreign keys were invented — this block only documents what is already
 * deployed.
 */

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

export const hrAttendancePolicies = sqliteTable(
  "hr_attendance_policies",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    timezone: text("timezone").notNull(),
    gracePeriodMinutes: integer("grace_period_minutes").notNull().default(0),
    absenceAfterMinutes: integer("absence_after_minutes"),
    minimumWorkMinutes: integer("minimum_work_minutes"),
    roundingIntervalMinutes: integer("rounding_interval_minutes")
      .notNull()
      .default(1),
    allowRemoteCheckIn: integer("allow_remote_check_in").notNull().default(0),
    requireLocation: integer("require_location").notNull().default(0),
    requireCorrectionApproval: integer("require_correction_approval")
      .notNull()
      .default(1),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_attendance_policies_business_code_uidx").on(
      table.businessId,
      table.code,
    ),
    index("hr_attendance_policies_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  ],
);

export const hrWorkSchedules = sqliteTable(
  "hr_work_schedules",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    attendancePolicyId: text("attendance_policy_id").notNull(),
    employeeId: text("employee_id"),
    departmentId: text("department_id"),
    positionId: text("position_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    timezone: text("timezone").notNull(),
    scheduleRules: text("schedule_rules").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_work_schedules_business_code_uidx").on(
      table.businessId,
      table.code,
    ),
    index("hr_work_schedules_business_employee_effective_idx").on(
      table.businessId,
      table.employeeId,
      table.effectiveFrom,
      table.effectiveTo,
    ),
    index("hr_work_schedules_business_department_status_idx").on(
      table.businessId,
      table.departmentId,
      table.status,
    ),
    index("hr_work_schedules_business_position_status_idx").on(
      table.businessId,
      table.positionId,
      table.status,
    ),
    index("hr_work_schedules_business_policy_idx").on(
      table.businessId,
      table.attendancePolicyId,
    ),
    index("hr_work_schedules_business_status_effective_idx").on(
      table.businessId,
      table.status,
      table.effectiveFrom,
      table.effectiveTo,
    ),
  ],
);

export const hrAttendanceRecords = sqliteTable(
  "hr_attendance_records",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    attendancePolicyId: text("attendance_policy_id"),
    workScheduleId: text("work_schedule_id"),
    workDate: integer("work_date", { mode: "timestamp" }).notNull(),
    expectedCheckInAt: integer("expected_check_in_at", { mode: "timestamp" }),
    expectedCheckOutAt: integer("expected_check_out_at", { mode: "timestamp" }),
    checkedInAt: integer("checked_in_at", { mode: "timestamp" }),
    checkedOutAt: integer("checked_out_at", { mode: "timestamp" }),
    workedMinutes: integer("worked_minutes").notNull().default(0),
    lateMinutes: integer("late_minutes").notNull().default(0),
    overtimeMinutes: integer("overtime_minutes").notNull().default(0),
    status: text("status").notNull(),
    checkInSource: text("check_in_source"),
    checkOutSource: text("check_out_source"),
    checkInLocation: text("check_in_location"),
    checkOutLocation: text("check_out_location"),
    notes: text("notes"),
    lockedAt: integer("locked_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_attendance_records_business_employee_date_uidx").on(
      table.businessId,
      table.employeeId,
      table.workDate,
    ),
    index("hr_attendance_records_business_date_status_idx").on(
      table.businessId,
      table.workDate,
      table.status,
    ),
    index("hr_attendance_records_business_employee_date_idx").on(
      table.businessId,
      table.employeeId,
      table.workDate,
    ),
    index("hr_attendance_records_business_schedule_date_idx").on(
      table.businessId,
      table.workScheduleId,
      table.workDate,
    ),
    index("hr_attendance_records_business_late_date_idx").on(
      table.businessId,
      table.lateMinutes,
      table.workDate,
    ),
  ],
);

export const hrAttendanceCorrections = sqliteTable(
  "hr_attendance_corrections",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    attendanceRecordId: text("attendance_record_id").notNull(),
    employeeId: text("employee_id").notNull(),
    requestedByUserId: text("requested_by_user_id").notNull(),
    requestedCheckInAt: integer("requested_check_in_at", { mode: "timestamp" }),
    requestedCheckOutAt: integer("requested_check_out_at", {
      mode: "timestamp",
    }),
    requestedStatus: text("requested_status"),
    reason: text("reason").notNull(),
    approvalRequestId: text("approval_request_id"),
    status: text("status").notNull().default("pending"),
    decidedByUserId: text("decided_by_user_id"),
    decisionNote: text("decision_note"),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("hr_attendance_corrections_business_record_idx").on(
      table.businessId,
      table.attendanceRecordId,
    ),
    index("hr_attendance_corrections_business_employee_status_idx").on(
      table.businessId,
      table.employeeId,
      table.status,
    ),
    index("hr_attendance_corrections_business_status_created_idx").on(
      table.businessId,
      table.status,
      table.createdAt,
    ),
    uniqueIndex("hr_attendance_corrections_business_approval_uidx").on(
      table.businessId,
      table.approvalRequestId,
    ),
  ],
);

export const hrLeaveTypes = sqliteTable(
  "hr_leave_types",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    unit: text("unit").notNull().default("days"),
    isPaid: integer("is_paid").notNull().default(1),
    requiresApproval: integer("requires_approval").notNull().default(1),
    allowNegativeBalance: integer("allow_negative_balance").notNull().default(0),
    accrualMethod: text("accrual_method").notNull(),
    defaultEntitlementMinutes: integer("default_entitlement_minutes")
      .notNull()
      .default(0),
    maximumCarryoverMinutes: integer("maximum_carryover_minutes"),
    minimumNoticeDays: integer("minimum_notice_days").notNull().default(0),
    maximumConsecutiveDays: integer("maximum_consecutive_days"),
    requiresDocument: integer("requires_document").notNull().default(0),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_leave_types_business_code_uidx").on(
      table.businessId,
      table.code,
    ),
    index("hr_leave_types_business_status_idx").on(
      table.businessId,
      table.status,
    ),
  ],
);

export const hrLeaveBalances = sqliteTable(
  "hr_leave_balances",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    leaveTypeId: text("leave_type_id").notNull(),
    periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
    openingMinutes: integer("opening_minutes").notNull().default(0),
    accruedMinutes: integer("accrued_minutes").notNull().default(0),
    carriedOverMinutes: integer("carried_over_minutes").notNull().default(0),
    adjustedMinutes: integer("adjusted_minutes").notNull().default(0),
    pendingMinutes: integer("pending_minutes").notNull().default(0),
    usedMinutes: integer("used_minutes").notNull().default(0),
    updatedByUserId: text("updated_by_user_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("hr_leave_balances_business_employee_type_period_uidx").on(
      table.businessId,
      table.employeeId,
      table.leaveTypeId,
      table.periodStart,
      table.periodEnd,
    ),
    index("hr_leave_balances_business_employee_period_idx").on(
      table.businessId,
      table.employeeId,
      table.periodStart,
      table.periodEnd,
    ),
    index("hr_leave_balances_business_type_period_idx").on(
      table.businessId,
      table.leaveTypeId,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const hrLeaveRequests = sqliteTable(
  "hr_leave_requests",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    leaveTypeId: text("leave_type_id").notNull(),
    leaveBalanceId: text("leave_balance_id"),
    requestedByUserId: text("requested_by_user_id").notNull(),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    startSegment: text("start_segment").notNull().default("full_day"),
    endSegment: text("end_segment").notNull().default("full_day"),
    requestedMinutes: integer("requested_minutes").notNull(),
    reason: text("reason"),
    handoverNotes: text("handover_notes"),
    emergencyContact: text("emergency_contact"),
    approvalRequestId: text("approval_request_id"),
    status: text("status").notNull().default("draft"),
    submittedAt: integer("submitted_at", { mode: "timestamp" }),
    decidedAt: integer("decided_at", { mode: "timestamp" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("hr_leave_requests_business_employee_status_idx").on(
      table.businessId,
      table.employeeId,
      table.status,
      table.startDate,
    ),
    index("hr_leave_requests_business_status_start_idx").on(
      table.businessId,
      table.status,
      table.startDate,
    ),
    index("hr_leave_requests_business_type_status_idx").on(
      table.businessId,
      table.leaveTypeId,
      table.status,
    ),
    index("hr_leave_requests_business_balance_idx").on(
      table.businessId,
      table.leaveBalanceId,
    ),
    uniqueIndex("hr_leave_requests_business_approval_uidx").on(
      table.businessId,
      table.approvalRequestId,
    ),
  ],
);

export const hrLeaveHistory = sqliteTable(
  "hr_leave_history",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    leaveTypeId: text("leave_type_id").notNull(),
    leaveRequestId: text("leave_request_id"),
    leaveBalanceId: text("leave_balance_id"),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    eventType: text("event_type").notNull(),
    minutesDelta: integer("minutes_delta").notNull().default(0),
    balanceBeforeMinutes: integer("balance_before_minutes"),
    balanceAfterMinutes: integer("balance_after_minutes"),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    reason: text("reason"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("hr_leave_history_business_employee_created_idx").on(
      table.businessId,
      table.employeeId,
      table.createdAt,
    ),
    index("hr_leave_history_business_request_created_idx").on(
      table.businessId,
      table.leaveRequestId,
      table.createdAt,
    ),
    index("hr_leave_history_business_balance_created_idx").on(
      table.businessId,
      table.leaveBalanceId,
      table.createdAt,
    ),
    index("hr_leave_history_business_type_event_idx").on(
      table.businessId,
      table.leaveTypeId,
      table.eventType,
      table.createdAt,
    ),
  ],
);

export const payrollAllowanceTypes = sqliteTable(
  "payroll_allowance_types",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    calculationMethod: text("calculation_method").notNull(),
    isTaxable: integer("is_taxable").notNull().default(1),
    isPensionable: integer("is_pensionable").notNull().default(0),
    isRecurring: integer("is_recurring").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_allowance_types_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_allowance_types_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollBonusAwards = sqliteTable(
  "payroll_bonus_awards",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    earningTypeId: text("earning_type_id"),
    payrollPeriodId: text("payroll_period_id"),
    currencyCode: text("currency_code").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    reason: text("reason").notNull(),
    approvalRequestId: text("approval_request_id"),
    status: text("status").notNull().default("draft"),
    awardedByUserId: text("awarded_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_bonus_awards_business_earning_idx").on(table.businessId, table.earningTypeId),
    uniqueIndex("payroll_bonus_awards_business_approval_uidx").on(table.businessId, table.approvalRequestId),
    index("payroll_bonus_awards_business_status_idx").on(table.businessId, table.status),
    index("payroll_bonus_awards_business_employee_period_idx").on(table.businessId, table.employeeId, table.payrollPeriodId),
  ],
);

export const payrollDeductionTypes = sqliteTable(
  "payroll_deduction_types",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    calculationMethod: text("calculation_method").notNull(),
    deductionCategory: text("deduction_category").notNull(),
    isPreTax: integer("is_pre_tax").notNull().default(0),
    isStatutory: integer("is_statutory").notNull().default(0),
    isRecurring: integer("is_recurring").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_deduction_types_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_deduction_types_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollEarningTypes = sqliteTable(
  "payroll_earning_types",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    calculationMethod: text("calculation_method").notNull(),
    isTaxable: integer("is_taxable").notNull().default(1),
    isPensionable: integer("is_pensionable").notNull().default(1),
    isRecurring: integer("is_recurring").notNull().default(1),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_earning_types_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_earning_types_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollEmployeeCompensationProfiles = sqliteTable(
  "payroll_employee_compensation_profiles",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeId: text("employee_id").notNull(),
    salaryStructureId: text("salary_structure_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    statutoryRuleSetId: text("statutory_rule_set_id"),
    currencyCode: text("currency_code").notNull(),
    payFrequency: text("pay_frequency").notNull(),
    baseAmountMinor: integer("base_amount_minor").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    approvalRequestId: text("approval_request_id"),
    status: text("status").notNull().default("draft"),
    createdByUserId: text("created_by_user_id").notNull(),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("payroll_employee_compensation_profiles_business_approval_uidx").on(table.businessId, table.approvalRequestId),
    index("payroll_employee_compensation_profiles_business_jurisdiction_idx").on(table.businessId, table.jurisdictionSettingId),
    index("payroll_employee_compensation_profiles_business_structure_idx").on(table.businessId, table.salaryStructureId),
    index("payroll_employee_compensation_profiles_business_employee_status_idx").on(table.businessId, table.employeeId, table.status),
    uniqueIndex("payroll_employee_compensation_profiles_business_employee_effective_uidx").on(table.businessId, table.employeeId, table.effectiveFrom),
  ],
);

export const payrollEmployeeComponents = sqliteTable(
  "payroll_employee_components",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    employeeCompensationProfileId: text("employee_compensation_profile_id").notNull(),
    employeeId: text("employee_id").notNull(),
    componentType: text("component_type").notNull(),
    earningTypeId: text("earning_type_id"),
    allowanceTypeId: text("allowance_type_id"),
    deductionTypeId: text("deduction_type_id"),
    calculationMethod: text("calculation_method").notNull(),
    amountMinor: integer("amount_minor"),
    rateBasisPoints: integer("rate_basis_points"),
    quantity: integer("quantity"),
    isTaxable: integer("is_taxable").notNull().default(0),
    isPensionable: integer("is_pensionable").notNull().default(0),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_employee_components_business_deduction_idx").on(table.businessId, table.deductionTypeId),
    index("payroll_employee_components_business_allowance_idx").on(table.businessId, table.allowanceTypeId),
    index("payroll_employee_components_business_earning_idx").on(table.businessId, table.earningTypeId),
    index("payroll_employee_components_business_profile_idx").on(table.businessId, table.employeeCompensationProfileId),
    index("payroll_employee_components_business_employee_effective_idx").on(table.businessId, table.employeeId, table.status, table.effectiveFrom, table.effectiveTo),
  ],
);

export const payrollJurisdictionSettings = sqliteTable(
  "payroll_jurisdiction_settings",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    countryCode: text("country_code").notNull(),
    currencyCode: text("currency_code").notNull(),
    timezone: text("timezone").notNull(),
    taxYearStartMonth: integer("tax_year_start_month").notNull().default(1),
    payFrequency: text("pay_frequency").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_jurisdiction_settings_business_effective_idx").on(table.businessId, table.effectiveFrom, table.effectiveTo),
    index("payroll_jurisdiction_settings_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_jurisdiction_settings_business_country_currency_uidx").on(table.businessId, table.countryCode, table.currencyCode, table.effectiveFrom),
  ],
);

export const payrollOvertimeCalculations = sqliteTable(
  "payroll_overtime_calculations",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollRunId: text("payroll_run_id").notNull(),
    payrollRunEmployeeId: text("payroll_run_employee_id").notNull(),
    employeeId: text("employee_id").notNull(),
    attendanceRecordId: text("attendance_record_id"),
    overtimeRuleId: text("overtime_rule_id").notNull(),
    workDate: integer("work_date", { mode: "timestamp" }).notNull(),
    eligibleMinutes: integer("eligible_minutes").notNull(),
    approvedMinutes: integer("approved_minutes").notNull(),
    hourlyRateMinor: integer("hourly_rate_minor").notNull(),
    multiplierBasisPoints: integer("multiplier_basis_points").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    approvalRequestId: text("approval_request_id"),
    status: text("status").notNull().default("calculated"),
    calculationSnapshot: text("calculation_snapshot").notNull(),
    calculatedAt: integer("calculated_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_overtime_calculations_business_status_idx").on(table.businessId, table.status),
    index("payroll_overtime_calculations_business_rule_idx").on(table.businessId, table.overtimeRuleId),
    index("payroll_overtime_calculations_business_employee_date_idx").on(table.businessId, table.employeeId, table.workDate),
    uniqueIndex("payroll_overtime_calculations_business_run_attendance_uidx").on(table.businessId, table.payrollRunId, table.attendanceRecordId),
  ],
);

export const payrollOvertimeRules = sqliteTable(
  "payroll_overtime_rules",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    dayType: text("day_type").notNull(),
    minimumMinutes: integer("minimum_minutes").notNull().default(0),
    maximumMinutes: integer("maximum_minutes"),
    multiplierBasisPoints: integer("multiplier_basis_points").notNull(),
    roundingIntervalMinutes: integer("rounding_interval_minutes").notNull().default(1),
    requiresApproval: integer("requires_approval").notNull().default(1),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_overtime_rules_business_jurisdiction_idx").on(table.businessId, table.jurisdictionSettingId, table.effectiveFrom, table.effectiveTo),
    index("payroll_overtime_rules_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_overtime_rules_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollPayslips = sqliteTable(
  "payroll_payslips",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollRunId: text("payroll_run_id").notNull(),
    payrollRunEmployeeId: text("payroll_run_employee_id").notNull(),
    payrollPeriodId: text("payroll_period_id").notNull(),
    employeeId: text("employee_id").notNull(),
    documentNumber: text("document_number").notNull(),
    storageProvider: text("storage_provider").notNull(),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    status: text("status").notNull().default("generated"),
    generatedAt: integer("generated_at", { mode: "timestamp" }).notNull(),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_payslips_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_payslips_business_storage_uidx").on(table.businessId, table.storageKey),
    index("payroll_payslips_business_employee_period_idx").on(table.businessId, table.employeeId, table.payrollPeriodId),
    uniqueIndex("payroll_payslips_business_run_employee_uidx").on(table.businessId, table.payrollRunEmployeeId),
  ],
);

export const payrollPeriods = sqliteTable(
  "payroll_periods",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    taxYear: integer("tax_year").notNull(),
    periodNumber: integer("period_number").notNull(),
    startDate: integer("start_date", { mode: "timestamp" }).notNull(),
    endDate: integer("end_date", { mode: "timestamp" }).notNull(),
    paymentDate: integer("payment_date", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("open"),
    lockedAt: integer("locked_at", { mode: "timestamp" }),
    lockedByUserId: text("locked_by_user_id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_periods_business_status_dates_idx").on(table.businessId, table.status, table.startDate, table.endDate),
    uniqueIndex("payroll_periods_business_tax_year_number_uidx").on(table.businessId, table.jurisdictionSettingId, table.taxYear, table.periodNumber),
    uniqueIndex("payroll_periods_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollRunEmployees = sqliteTable(
  "payroll_run_employees",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollRunId: text("payroll_run_id").notNull(),
    payrollPeriodId: text("payroll_period_id").notNull(),
    employeeId: text("employee_id").notNull(),
    compensationProfileId: text("compensation_profile_id").notNull(),
    employeeNumberSnapshot: text("employee_number_snapshot").notNull(),
    employeeNameSnapshot: text("employee_name_snapshot").notNull(),
    currencyCode: text("currency_code").notNull(),
    baseAmountMinor: integer("base_amount_minor").notNull().default(0),
    grossAmountMinor: integer("gross_amount_minor").notNull().default(0),
    taxableAmountMinor: integer("taxable_amount_minor").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    deductionAmountMinor: integer("deduction_amount_minor").notNull().default(0),
    netAmountMinor: integer("net_amount_minor").notNull().default(0),
    status: text("status").notNull().default("pending"),
    calculationSnapshot: text("calculation_snapshot").notNull(),
    calculatedAt: integer("calculated_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_run_employees_business_run_status_idx").on(table.businessId, table.payrollRunId, table.status),
    index("payroll_run_employees_business_employee_idx").on(table.businessId, table.employeeId, table.payrollPeriodId),
    uniqueIndex("payroll_run_employees_business_run_employee_uidx").on(table.businessId, table.payrollRunId, table.employeeId),
  ],
);

export const payrollRunEvents = sqliteTable(
  "payroll_run_events",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollRunId: text("payroll_run_id").notNull(),
    payrollRunEmployeeId: text("payroll_run_employee_id"),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorType: text("actor_type").notNull(),
    actorUserId: text("actor_user_id"),
    approvalRequestId: text("approval_request_id"),
    reason: text("reason"),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_run_events_business_actor_created_idx").on(table.businessId, table.actorUserId, table.createdAt),
    index("payroll_run_events_business_employee_created_idx").on(table.businessId, table.payrollRunEmployeeId, table.createdAt),
    index("payroll_run_events_business_run_created_idx").on(table.businessId, table.payrollRunId, table.createdAt),
  ],
);

export const payrollRunItems = sqliteTable(
  "payroll_run_items",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollRunId: text("payroll_run_id").notNull(),
    payrollRunEmployeeId: text("payroll_run_employee_id").notNull(),
    employeeId: text("employee_id").notNull(),
    itemType: text("item_type").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: text("source_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity"),
    rateBasisPoints: integer("rate_basis_points"),
    amountMinor: integer("amount_minor").notNull(),
    taxableAmountMinor: integer("taxable_amount_minor").notNull().default(0),
    pensionableAmountMinor: integer("pensionable_amount_minor").notNull().default(0),
    metadata: text("metadata"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_run_items_business_employee_code_idx").on(table.businessId, table.employeeId, table.code),
    index("payroll_run_items_business_source_idx").on(table.businessId, table.sourceType, table.sourceId),
    index("payroll_run_items_business_run_type_idx").on(table.businessId, table.payrollRunId, table.itemType),
    index("payroll_run_items_business_run_employee_idx").on(table.businessId, table.payrollRunEmployeeId),
  ],
);

export const payrollRuns = sqliteTable(
  "payroll_runs",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    payrollPeriodId: text("payroll_period_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    statutoryRuleSetId: text("statutory_rule_set_id").notNull(),
    runNumber: integer("run_number").notNull(),
    currencyCode: text("currency_code").notNull(),
    status: text("status").notNull().default("draft"),
    employeeCount: integer("employee_count").notNull().default(0),
    grossAmountMinor: integer("gross_amount_minor").notNull().default(0),
    taxAmountMinor: integer("tax_amount_minor").notNull().default(0),
    deductionAmountMinor: integer("deduction_amount_minor").notNull().default(0),
    netAmountMinor: integer("net_amount_minor").notNull().default(0),
    approvalRequestId: text("approval_request_id"),
    preparedByUserId: text("prepared_by_user_id").notNull(),
    preparedAt: integer("prepared_at", { mode: "timestamp" }).notNull(),
    approvedByUserId: text("approved_by_user_id"),
    approvedAt: integer("approved_at", { mode: "timestamp" }),
    finalizedByUserId: text("finalized_by_user_id"),
    finalizedAt: integer("finalized_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_runs_business_preparer_idx").on(table.businessId, table.preparedByUserId, table.createdAt),
    index("payroll_runs_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_runs_business_approval_uidx").on(table.businessId, table.approvalRequestId),
    index("payroll_runs_business_period_status_idx").on(table.businessId, table.payrollPeriodId, table.status),
    uniqueIndex("payroll_runs_business_period_number_uidx").on(table.businessId, table.payrollPeriodId, table.runNumber),
    check("payroll_runs_approved_ne_prepared", sql`${table.approvedByUserId} IS NULL OR ${table.approvedByUserId} <> ${table.preparedByUserId}`),
    check("payroll_runs_finalized_ne_prepared", sql`${table.finalizedByUserId} IS NULL OR ${table.finalizedByUserId} <> ${table.preparedByUserId}`),
    check("payroll_runs_finalized_ne_approved", sql`${table.finalizedByUserId} IS NULL OR ${table.approvedByUserId} IS NULL OR ${table.finalizedByUserId} <> ${table.approvedByUserId}`),
  ],
);

export const payrollSalaryStructures = sqliteTable(
  "payroll_salary_structures",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    currencyCode: text("currency_code").notNull(),
    payFrequency: text("pay_frequency").notNull(),
    minimumBaseAmountMinor: integer("minimum_base_amount_minor"),
    maximumBaseAmountMinor: integer("maximum_base_amount_minor"),
    status: text("status").notNull().default("active"),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    index("payroll_salary_structures_business_frequency_idx").on(table.businessId, table.payFrequency, table.status),
    index("payroll_salary_structures_business_jurisdiction_idx").on(table.businessId, table.jurisdictionSettingId),
    index("payroll_salary_structures_business_status_idx").on(table.businessId, table.status),
    uniqueIndex("payroll_salary_structures_business_code_uidx").on(table.businessId, table.code),
  ],
);

export const payrollStatutoryRuleSets = sqliteTable(
  "payroll_statutory_rule_sets",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id").notNull(),
    jurisdictionSettingId: text("jurisdiction_setting_id").notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    version: text("version").notNull(),
    effectiveFrom: integer("effective_from", { mode: "timestamp" }).notNull(),
    effectiveTo: integer("effective_to", { mode: "timestamp" }),
    rules: text("rules").notNull(),
    sourceReference: text("source_reference"),
    checksum: text("checksum").notNull(),
    status: text("status").notNull().default("draft"),
    publishedByUserId: text("published_by_user_id"),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    createdByUserId: text("created_by_user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("payroll_statutory_rule_sets_business_checksum_uidx").on(table.businessId, table.checksum),
    index("payroll_statutory_rule_sets_business_status_idx").on(table.businessId, table.status),
    index("payroll_statutory_rule_sets_business_effective_idx").on(table.businessId, table.jurisdictionSettingId, table.effectiveFrom, table.effectiveTo),
    uniqueIndex("payroll_statutory_rule_sets_business_code_version_uidx").on(table.businessId, table.jurisdictionSettingId, table.code, table.version),
  ],
);


/**
 * Identity/permissions/approvals, notification, and skills/website-widget
 * tables. These already exist in the deployed database but had no
 * db/schema.ts definitions. Recovered verbatim (column-for-column and
 * index-for-index verified against the live schema) from the same
 * locally-recovered historical schema.ts snapshot used for the HR/payroll
 * recovery, except:
 *  - employeeSkills: the recovered source had extra `status`/`installedAt`
 *    columns and a `.references()` FK not present live; both were dropped
 *    to match the deployed table exactly.
 *  - websiteWidgets: the recovered source had an extra
 *    `website_widgets_business_status_idx` index not present live; dropped
 *    to match the deployed table exactly.
 * `legacy_ai_employee_teams_pre_0001` (an archival rename target from a
 * canonical-branch migration, zero rows, zero application references) and
 * `__drizzle_migrations` (drizzle-kit's own bookkeeping table) are
 * intentionally not modeled here.
 */

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
);

export const employeeSkills = sqliteTable(
  "employee_skills",
  {
    id: text("id").primaryKey(),

    employeeId: text("employee_id")
      .notNull(),

    skillId: text("skill_id")
      .notNull(),

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
