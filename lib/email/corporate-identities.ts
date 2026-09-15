/**
 * Official mailbox identities for the SuperKuba corporate workspace.
 *
 * This is deliberately keyed by the corporate business slug. It is not a
 * default for customer tenants and does not alter employee roles, tools, or
 * channel configuration. Outbound callers may use the identity; inbound
 * routing uses the explicit primary employee type for shared mailboxes.
 */
export const SUPERKUBA_CORPORATE_BUSINESS_SLUG = "superkuba";

export const SUPERKUBA_EMPLOYEE_EMAILS = {
  receptionist: "hello@superkuba.com",
  sales: "sales@superkuba.com",
  outreach: "sales@superkuba.com",
  "customer-support": "support@superkuba.com",
  operations: "onboarding@superkuba.com",
  finance: "billing@superkuba.com",
  accountant: "billing@superkuba.com",
  "general-manager": "partnerships@superkuba.com",
  hr: "people@superkuba.com",
} as const;

/** The employee that owns inbound mail when one mailbox is shared. */
export const SUPERKUBA_PRIMARY_INBOUND_EMPLOYEE_BY_EMAIL = {
  "hello@superkuba.com": "receptionist",
  "sales@superkuba.com": "sales",
  "support@superkuba.com": "customer-support",
  "onboarding@superkuba.com": "operations",
  "billing@superkuba.com": "finance",
  "partnerships@superkuba.com": "general-manager",
  "people@superkuba.com": "hr",
} as const;

export type SuperKubaEmployeeType = keyof typeof SUPERKUBA_EMPLOYEE_EMAILS;

export function getCorporateEmployeeEmail(params: {
  businessSlug: string;
  employeeType: string;
}): string | null {
  if (params.businessSlug !== SUPERKUBA_CORPORATE_BUSINESS_SLUG) return null;
  return SUPERKUBA_EMPLOYEE_EMAILS[params.employeeType as SuperKubaEmployeeType] ?? null;
}

export function getPrimaryInboundEmployeeType(params: {
  businessSlug: string;
  mailbox: string;
}): string | null {
  if (params.businessSlug !== SUPERKUBA_CORPORATE_BUSINESS_SLUG) return null;
  return SUPERKUBA_PRIMARY_INBOUND_EMPLOYEE_BY_EMAIL[
    params.mailbox.trim().toLowerCase() as keyof typeof SUPERKUBA_PRIMARY_INBOUND_EMPLOYEE_BY_EMAIL
  ] ?? null;
}
