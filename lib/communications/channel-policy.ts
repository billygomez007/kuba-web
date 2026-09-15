import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployeeScopes } from "@/db/schema";

/*
 * Single canonical channel-eligibility policy for the AI Workforce. Every
 * channel adapter (Website Chat, WhatsApp, and — when built — Email/Voice)
 * and every AI-initiated handoff must consult this module rather than
 * deciding eligibility inline. "dashboard" is a pseudo-channel representing
 * the internal per-employee test console / GenericChatWorkspace — never a
 * real customer channel, so every type is eligible there.
 */
export type ChannelName = "website_chat" | "whatsapp" | "email" | "voice" | "dashboard";

export const REAL_CUSTOMER_CHANNELS: readonly ChannelName[] = ["website_chat", "whatsapp", "email", "voice"];

type EmployeeChannelPolicy = {
  /** Whether this type is customer-facing by product default (informational — the real gate is `inbound`). */
  customerFacing: boolean;
  /** Channels this type may be automatically routed a customer conversation on, when active. */
  inbound: readonly ChannelName[];
  purpose: string;
};

/**
 * Canonical per-type channel policy (spec section 2). Only receptionist,
 * sales, customer-support, and appointment are customer-facing by default —
 * every other type (including custom) is internal-only until explicitly
 * configured otherwise. This is deliberately independent of
 * lib/billing/ai-workforce-policy.ts's commercial/implementation gates —
 * a type can be entitled and implemented yet still not channel-eligible.
 */
const EMPLOYEE_CHANNEL_POLICY: Record<string, EmployeeChannelPolicy> = {
  "receptionist": { customerFacing: true, inbound: ["website_chat", "whatsapp", "email", "voice"], purpose: "First-line customer interaction and routing." },
  "sales": { customerFacing: true, inbound: ["website_chat", "whatsapp", "email", "voice"], purpose: "Qualified sales opportunities." },
  "customer-support": { customerFacing: true, inbound: ["website_chat", "whatsapp", "email", "voice"], purpose: "Existing-customer service/support." },
  "appointment": { customerFacing: true, inbound: ["website_chat", "whatsapp", "email", "voice"], purpose: "Booking/scheduling workflows." },
  "marketing": { customerFacing: false, inbound: [], purpose: "Internal/outbound campaign planning and content — no general inbound routing by default." },
  "outreach": { customerFacing: false, inbound: [], purpose: "Outbound-only prospecting." },
  "general-manager": { customerFacing: false, inbound: [], purpose: "Internal business oversight." },
  "accountant": { customerFacing: false, inbound: [], purpose: "Internal accounting support." },
  "finance": { customerFacing: false, inbound: [], purpose: "Internal financial planning support." },
  "hr": { customerFacing: false, inbound: [], purpose: "Internal HR support." },
  "operations": { customerFacing: false, inbound: [], purpose: "Internal operations coordination." },
  "custom": { customerFacing: false, inbound: [], purpose: "Internal by default; a channel is eligible only via an explicit per-employee grant." },
};

function normalizeType(type: string): string {
  return type.trim().toLowerCase();
}

/** Every channel is eligible on the internal dashboard/test-console pseudo-channel. */
export function isEmployeeChannelEligible(
  employee: { id: string; type: string },
  channel: ChannelName,
): boolean {
  if (channel === "dashboard") return true;
  const policy = EMPLOYEE_CHANNEL_POLICY[normalizeType(employee.type)];
  // Fail closed: a type this policy does not model is never channel-eligible.
  return policy ? policy.inbound.includes(channel) : false;
}

/** aiEmployeeScopes.scope value for a Custom employee's explicit channel grant. */
export function customChannelScope(channel: ChannelName): string {
  return `channel:${channel}`;
}

/**
 * Custom employees are internal-only per the static policy above, but an
 * owner/admin may explicitly grant a real customer channel — reusing the
 * same aiEmployeeScopes table (and the same grant/revoke convention) as
 * Custom's curated tool permissions, rather than inventing new schema.
 */
export async function isCustomEmployeeChannelGranted(
  businessId: string,
  employeeId: string,
  channel: ChannelName,
): Promise<boolean> {
  if (channel === "dashboard") return true;
  const rows = await db
    .select({ id: aiEmployeeScopes.id })
    .from(aiEmployeeScopes)
    .where(
      and(
        eq(aiEmployeeScopes.businessId, businessId),
        eq(aiEmployeeScopes.aiEmployeeId, employeeId),
        eq(aiEmployeeScopes.scope, customChannelScope(channel)),
        eq(aiEmployeeScopes.effect, "allow"),
        eq(aiEmployeeScopes.status, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * The full eligibility check a channel adapter/handoff resolver must use:
 * the static policy for standard types, or an explicit grant lookup for
 * Custom. Never trusts a client/model-supplied override.
 */
export async function isEmployeeEligibleForChannel(
  businessId: string,
  employee: { id: string; type: string },
  channel: ChannelName,
): Promise<boolean> {
  if (isEmployeeChannelEligible(employee, channel)) return true;
  if (normalizeType(employee.type) === "custom") {
    return isCustomEmployeeChannelGranted(businessId, employee.id, channel);
  }
  return false;
}

export function isCustomerFacingByDefault(type: string): boolean {
  return EMPLOYEE_CHANNEL_POLICY[normalizeType(type)]?.customerFacing ?? false;
}
