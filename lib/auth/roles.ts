import {
  PERMISSIONS,
  getRolePermissions,
  type Permission,
} from "@/lib/auth/permissions";

export type BusinessRole =
  | "owner"
  | "admin"
  | "manager"
  | "sales"
  | "accountant"
  | "receptionist"
  | "member";

export const BUSINESS_ROLES: BusinessRole[] = [
  "owner",
  "admin",
  "manager",
  "sales",
  "accountant",
  "receptionist",
  "member",
];

export const ROLE_LABELS: Record<
  BusinessRole,
  string
> = {
  owner: "Owner",
  admin: "Administrator",
  manager: "Manager",
  sales: "Sales",
  accountant: "Accountant",
  receptionist: "Receptionist",
  member: "Team Member",
};

export const ROLE_DESCRIPTIONS: Record<
  BusinessRole,
  string
> = {
  owner:
    "Full business ownership and unrestricted access.",
  admin:
    "Administrative access across the workspace.",
  manager:
    "Manage teams, customers, sales and operations.",
  sales:
    "Manage leads, sales activities and customer relationships.",
  accountant:
    "Manage accounting and financial operations.",
  receptionist:
    "Handle reception, customers, messaging and follow-ups.",
  member:
    "Basic workspace access.",
};

export function getBusinessRoles() {
  return BUSINESS_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
    description: ROLE_DESCRIPTIONS[role],
    permissions:
      getRolePermissions(role),
  }));
}

export function getRoleLabel(
  role: string,
) {
  return (
    ROLE_LABELS[
      role as BusinessRole
    ] ?? role
  );
}

export function getRoleDescription(
  role: string,
) {
  return (
    ROLE_DESCRIPTIONS[
      role as BusinessRole
    ] ??
    "Custom business role."
  );
}
