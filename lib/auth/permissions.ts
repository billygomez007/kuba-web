import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { businessUsers } from "@/db/schema";

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",

  SALES_VIEW: "sales.view",
  SALES_MANAGE: "sales.manage",
  SALES_AI: "sales.ai",

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

function parsePermissions(
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

export async function getBusinessMembership(
  userId: string,
  businessId?: string,
) {
  const conditions = [
    eq(
      businessUsers.userId,
      userId,
    ),
  ];

  if (businessId) {
    conditions.push(
      eq(
        businessUsers.businessId,
        businessId,
      ),
    );
  }

  const result = await db
    .select()
    .from(businessUsers)
    .where(and(...conditions));

  if (!businessId && result.length !== 1) {
    return null;
  }

  return result[0] || null;
}

export async function userHasPermission(
  userId: string,
  permission: Permission,
  businessId?: string,
) {
  const membership =
    await getBusinessMembership(
      userId,
      businessId,
    );

  if (!membership) {
    return false;
  }

  return hasPermission(
    membership.role,
    membership.permissions,
    permission,
  );
}

export type AuthorizedMembership = {
  id: string;
  businessId: string;
  userId: string;
  role: string;
  permissions: string | null;
  branchId: string | null;
};

export async function requirePermission(
  userId: string,
  permission: Permission,
  businessId?: string,
): Promise<AuthorizedMembership> {
  const membership =
    await getBusinessMembership(
      userId,
      businessId,
    );

  if (!membership) {
    throw new Error(
      "BUSINESS_ACCESS_DENIED",
    );
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      permission,
    );

  if (!allowed) {
    throw new Error(
      "PERMISSION_DENIED",
    );
  }

  return membership as AuthorizedMembership;
}


export const BUSINESS_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  SALES: "sales",
  RECEPTIONIST: "receptionist",
  ACCOUNTANT: "accountant",
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
    role === BUSINESS_ROLES.MANAGER ||
    role === BUSINESS_ROLES.SALES ||
    role === BUSINESS_ROLES.RECEPTIONIST ||
    role === BUSINESS_ROLES.ACCOUNTANT ||
    role === BUSINESS_ROLES.CUSTOM
  );
}


export const PERMISSION_GROUPS = {
  core: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ANALYTICS_VIEW,
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
