// Pure permission/role logic — no database import, ever. This module must
// stay safe to import from a "use client" component: lib/auth/roles.ts
// (imported by app/dashboard/settings/team/page.tsx) depends on it. The
// live bug this file exists to prevent: lib/auth/roles.ts used to import
// PERMISSIONS/getRolePermissions from lib/auth/permissions.ts, which also
// exports DB-touching functions and therefore imports "@/db" at module
// scope. "@/db" constructs a libsql client from TURSO_DATABASE_URL at
// import time — a server-only env var that is `undefined` in the browser —
// so simply importing that module into a client bundle threw
// `LibsqlError: URL_INVALID` the instant the bundle evaluated, before React
// ever rendered anything, tripping the app's global-error boundary
// ("This page couldn't load") for every visitor to Team & Staff. Keep every
// DB-touching function (getBusinessMembership, userHasPermission,
// requirePermission) in lib/auth/permissions.ts, which re-exports
// everything here for existing server-side callers.
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",

  SALES_VIEW: "sales.view",
  SALES_MANAGE: "sales.manage",
  SALES_AI: "sales.ai",

  CRM_VIEW: "crm.view",
  CRM_MANAGE: "crm.manage",
  CRM_PIPELINE_MANAGE: "crm.pipeline.manage",
  CRM_DEAL_MANAGE: "crm.deal.manage",

  OUTREACH_VIEW: "outreach.view",
  OUTREACH_MANAGE: "outreach.manage",

  MARKETING_VIEW: "marketing.view",
  MARKETING_MANAGE: "marketing.manage",
  MARKETING_CAMPAIGNS_MANAGE: "marketing.campaigns.manage",
  MARKETING_CONTENT_MANAGE: "marketing.content.manage",
  MARKETING_AUDIENCES_MANAGE: "marketing.audiences.manage",
  MARKETING_ASSETS_MANAGE: "marketing.assets.manage",
  MARKETING_APPROVALS_REVIEW: "marketing.approvals.review",
  MARKETING_PUBLISH: "marketing.publish",
  MARKETING_ANALYTICS_VIEW: "marketing.analytics.view",
  MARKETING_SOCIAL_MANAGE: "marketing.social.manage",

  ACCOUNTING_VIEW: "accounting.view",
  ACCOUNTING_MANAGE: "accounting.manage",
  ACCOUNTING_AI: "accounting.ai",

  RECEPTION_VIEW: "reception.view",
  RECEPTION_MANAGE: "reception.manage",
  RECEPTION_AI: "reception.ai",

  ANALYTICS_VIEW: "analytics.view",

  TASKS_VIEW: "tasks.view",
  TASKS_MANAGE: "tasks.manage",

  FOLLOWUPS_VIEW: "followups.view",
  FOLLOWUPS_MANAGE: "followups.manage",

  KNOWLEDGE_VIEW: "knowledge.view",
  KNOWLEDGE_MANAGE: "knowledge.manage",

  WORKFORCE_VIEW: "workforce.view",
  WORKFORCE_MANAGE: "workforce.manage",

  AUTOMATIONS_VIEW: "automations.view",
  AUTOMATIONS_MANAGE: "automations.manage",

  MESSAGING_VIEW: "messaging.view",
  MESSAGING_MANAGE: "messaging.manage",

  INTEGRATIONS_VIEW: "integrations.view",
  INTEGRATIONS_MANAGE: "integrations.manage",

  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",

  SETTINGS_VIEW: "settings.view",
  SETTINGS_MANAGE: "settings.manage",

  BILLING_VIEW: "billing.view",
  BILLING_MANAGE: "billing.manage",
} as const;

export type Permission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS =
  Object.values(PERMISSIONS);

const ROLE_PERMISSIONS: Record<
  string,
  string[]
> = {
  owner: ALL_PERMISSIONS,

  admin: ALL_PERMISSIONS.filter(
    (permission) =>
      !permission.startsWith("billing."),
  ),

  manager: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,

    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_MANAGE,
    PERMISSIONS.SALES_AI,
    PERMISSIONS.CRM_VIEW,
    PERMISSIONS.CRM_MANAGE,
    PERMISSIONS.CRM_PIPELINE_MANAGE,
    PERMISSIONS.CRM_DEAL_MANAGE,

    PERMISSIONS.OUTREACH_VIEW,
    PERMISSIONS.OUTREACH_MANAGE,

    PERMISSIONS.MARKETING_VIEW,
    PERMISSIONS.MARKETING_MANAGE,
    PERMISSIONS.MARKETING_CAMPAIGNS_MANAGE,
    PERMISSIONS.MARKETING_CONTENT_MANAGE,
    PERMISSIONS.MARKETING_AUDIENCES_MANAGE,
    PERMISSIONS.MARKETING_ASSETS_MANAGE,
    PERMISSIONS.MARKETING_APPROVALS_REVIEW,
    PERMISSIONS.MARKETING_ANALYTICS_VIEW,

    PERMISSIONS.ACCOUNTING_VIEW,

    PERMISSIONS.RECEPTION_VIEW,

    PERMISSIONS.ANALYTICS_VIEW,

    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_MANAGE,

    PERMISSIONS.FOLLOWUPS_VIEW,
    PERMISSIONS.FOLLOWUPS_MANAGE,

    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.KNOWLEDGE_MANAGE,

    PERMISSIONS.WORKFORCE_VIEW,

    PERMISSIONS.AUTOMATIONS_VIEW,

    PERMISSIONS.MESSAGING_VIEW,
    PERMISSIONS.MESSAGING_MANAGE,
  ],

  sales: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.CUSTOMERS_VIEW,

    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_MANAGE,
    PERMISSIONS.SALES_AI,
    PERMISSIONS.CRM_VIEW,
    PERMISSIONS.CRM_MANAGE,
    PERMISSIONS.CRM_DEAL_MANAGE,

    PERMISSIONS.OUTREACH_VIEW,
    PERMISSIONS.OUTREACH_MANAGE,

    PERMISSIONS.MARKETING_VIEW,
    PERMISSIONS.MARKETING_ANALYTICS_VIEW,

    PERMISSIONS.ANALYTICS_VIEW,

    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_MANAGE,

    PERMISSIONS.FOLLOWUPS_VIEW,
    PERMISSIONS.FOLLOWUPS_MANAGE,

    PERMISSIONS.KNOWLEDGE_VIEW,

    PERMISSIONS.MESSAGING_VIEW,
    PERMISSIONS.MESSAGING_MANAGE,
  ],

  accountant: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.CUSTOMERS_VIEW,

    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.ACCOUNTING_AI,

    PERMISSIONS.ANALYTICS_VIEW,

    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_MANAGE,

    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.KNOWLEDGE_MANAGE,
  ],

  receptionist: [
    PERMISSIONS.DASHBOARD_VIEW,

    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,

    PERMISSIONS.RECEPTION_VIEW,
    PERMISSIONS.RECEPTION_MANAGE,
    PERMISSIONS.RECEPTION_AI,

    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_MANAGE,

    PERMISSIONS.FOLLOWUPS_VIEW,
    PERMISSIONS.FOLLOWUPS_MANAGE,

    PERMISSIONS.MESSAGING_VIEW,
    PERMISSIONS.MESSAGING_MANAGE,

    PERMISSIONS.KNOWLEDGE_VIEW,
  ],

  member: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.MESSAGING_VIEW,
  ],
};

export function parsePermissions(
  permissions: string | null,
): string[] {
  if (!permissions) {
    return [];
  }

  try {
    const parsed =
      JSON.parse(permissions);

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (value): value is string =>
          typeof value === "string",
      );
    }

    return [];
  } catch {
    return permissions
      .split(",")
      .map((permission) =>
        permission.trim(),
      )
      .filter(Boolean);
  }
}

export function getRolePermissions(
  role: string,
): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(
  role: string,
  storedPermissions: string | null,
  permission: Permission,
): boolean {
  if (role === "owner") {
    return true;
  }

  const rolePermissions =
    getRolePermissions(role);

  const customPermissions =
    parsePermissions(
      storedPermissions,
    );

  return (
    rolePermissions.includes(permission) ||
    customPermissions.includes(permission)
  );
}

export const BUSINESS_ROLES = {
  OWNER: "owner",
  ADMIN: "admin",
  MANAGER: "manager",
  SALES: "sales",
  RECEPTIONIST: "receptionist",
  ACCOUNTANT: "accountant",
  MEMBER: "member",
  CUSTOM: "custom",
} as const;

export type BusinessRole =
  (typeof BUSINESS_ROLES)[keyof typeof BUSINESS_ROLES];

export const ROLE_DEFINITIONS = {
  owner: {
    name: "CEO / Owner",
    description:
      "Full control of the business, team, settings, billing, integrations, and Kuba.",
  },

  manager: {
    name: "Manager",
    description:
      "Manages day-to-day business operations and assigned teams without owner-level access.",
  },

  sales: {
    name: "Sales",
    description:
      "Manages leads, customers, sales activities, follow-ups, and sales AI.",
  },

  receptionist: {
    name: "Receptionist",
    description:
      "Handles customer enquiries, conversations, reception activities, and follow-ups.",
  },

  accountant: {
    name: "Accountant",
    description:
      "Handles accounting-related information, tasks, reports, and accounting AI.",
  },

  custom: {
    name: "Custom Role",
    description:
      "A customized role with permissions selected by an authorized business administrator.",
  },
} as const;

export function isBusinessRole(
  role: string,
): role is BusinessRole {
  return (
    role === BUSINESS_ROLES.OWNER ||
    role === BUSINESS_ROLES.ADMIN ||
    role === BUSINESS_ROLES.MANAGER ||
    role === BUSINESS_ROLES.SALES ||
    role === BUSINESS_ROLES.RECEPTIONIST ||
    role === BUSINESS_ROLES.ACCOUNTANT ||
    role === BUSINESS_ROLES.MEMBER ||
    role === BUSINESS_ROLES.CUSTOM
  );
}

export const PERMISSION_GROUPS = {
  core: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
  ],

  marketing: [
    PERMISSIONS.MARKETING_VIEW,
    PERMISSIONS.MARKETING_MANAGE,
    PERMISSIONS.MARKETING_CAMPAIGNS_MANAGE,
    PERMISSIONS.MARKETING_CONTENT_MANAGE,
    PERMISSIONS.MARKETING_AUDIENCES_MANAGE,
    PERMISSIONS.MARKETING_ASSETS_MANAGE,
    PERMISSIONS.MARKETING_APPROVALS_REVIEW,
    PERMISSIONS.MARKETING_PUBLISH,
    PERMISSIONS.MARKETING_ANALYTICS_VIEW,
    PERMISSIONS.MARKETING_SOCIAL_MANAGE,
  ],

  customers: [
    PERMISSIONS.CUSTOMERS_VIEW,
    PERMISSIONS.CUSTOMERS_MANAGE,
  ],

  sales: [
    PERMISSIONS.SALES_VIEW,
    PERMISSIONS.SALES_MANAGE,
    PERMISSIONS.SALES_AI,
  ],

  accounting: [
    PERMISSIONS.ACCOUNTING_VIEW,
    PERMISSIONS.ACCOUNTING_MANAGE,
    PERMISSIONS.ACCOUNTING_AI,
  ],

  reception: [
    PERMISSIONS.RECEPTION_VIEW,
    PERMISSIONS.RECEPTION_MANAGE,
    PERMISSIONS.RECEPTION_AI,
  ],

  tasks: [
    PERMISSIONS.TASKS_VIEW,
    PERMISSIONS.TASKS_MANAGE,
  ],

  followups: [
    PERMISSIONS.FOLLOWUPS_VIEW,
    PERMISSIONS.FOLLOWUPS_MANAGE,
  ],

  knowledge: [
    PERMISSIONS.KNOWLEDGE_VIEW,
    PERMISSIONS.KNOWLEDGE_MANAGE,
  ],

  workforce: [
    PERMISSIONS.WORKFORCE_VIEW,
    PERMISSIONS.WORKFORCE_MANAGE,
  ],

  automations: [
    PERMISSIONS.AUTOMATIONS_VIEW,
    PERMISSIONS.AUTOMATIONS_MANAGE,
  ],

  messaging: [
    PERMISSIONS.MESSAGING_VIEW,
    PERMISSIONS.MESSAGING_MANAGE,
  ],

  integrations: [
    PERMISSIONS.INTEGRATIONS_VIEW,
    PERMISSIONS.INTEGRATIONS_MANAGE,
  ],

  users: [
    PERMISSIONS.USERS_VIEW,
    PERMISSIONS.USERS_MANAGE,
  ],

  settings: [
    PERMISSIONS.SETTINGS_VIEW,
    PERMISSIONS.SETTINGS_MANAGE,
  ],

  billing: [
    PERMISSIONS.BILLING_VIEW,
    PERMISSIONS.BILLING_MANAGE,
  ],
} as const;

export type TeamMemberRole =
  | "owner"
  | "manager"
  | "sales"
  | "receptionist"
  | "accountant"
  | "custom";

export function getRoleDefinition(
  role: string,
) {
  return (
    ROLE_DEFINITIONS[
      role as keyof typeof ROLE_DEFINITIONS
    ] || ROLE_DEFINITIONS.custom
  );
}

export function getEffectivePermissions(
  role: string,
  storedPermissions: string | null,
): string[] {
  const rolePermissions =
    getRolePermissions(role);

  const customPermissions =
    parsePermissions(
      storedPermissions,
    );

  return Array.from(
    new Set([
      ...rolePermissions,
      ...customPermissions,
    ]),
  );
}

export function canManageRole(
  actorRole: string,
  targetRole: string,
): boolean {
  if (actorRole === "owner") {
    return targetRole !== "owner";
  }

  if (actorRole === "manager") {
    return (
      targetRole !== "owner" &&
      targetRole !== "manager"
    );
  }

  return false;
}

export function canGrantPermission(
  actorRole: string,
  permission: string,
): boolean {
  if (actorRole === "owner") {
    return true;
  }

  if (actorRole === "manager") {
    const restrictedPermissions = [
      PERMISSIONS.USERS_MANAGE,
      PERMISSIONS.BILLING_MANAGE,
      PERMISSIONS.INTEGRATIONS_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
    ];

    return !restrictedPermissions.includes(
      permission as typeof restrictedPermissions[number],
    );
  }

  return false;
}

export function filterGrantablePermissions(
  actorRole: string,
  permissions: string[],
): string[] {
  return permissions.filter(
    (permission) =>
      canGrantPermission(
        actorRole,
        permission,
      ),
  );
}
