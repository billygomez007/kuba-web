import {
  kubaReceptionistAgent,
} from "@/mastra/agents/receptionist";

import {
  kubaSalesAgent,
} from "@/mastra/agents/sales";

import {
  kubaCustomerSupportAgent,
} from "@/mastra/agents/customer-support";

import {
  kubaGeneralManagerAgent,
} from "@/mastra/agents/general-manager";

import { kubaOutreachAgent } from "@/mastra/agents/outreach";
import { kubaMarketingAgent } from "@/mastra/agents/marketing";
import { kubaAppointmentAgent } from "@/mastra/agents/appointment";
import { kubaAccountantAgent } from "@/mastra/agents/accountant";
import { kubaFinanceAgent } from "@/mastra/agents/finance";
import { kubaHrAgent } from "@/mastra/agents/hr";
import { kubaOperationsAgent } from "@/mastra/agents/operations";

/*
 * Every static (non-Custom) employee type's canonical Mastra agent, keyed
 * EXACTLY by the same hyphenated type string stored in aiEmployees.type and
 * used everywhere else in this codebase (lib/billing/ai-workforce-policy.ts,
 * lib/billing/ai-workforce-catalog.ts, every app/api/ai/{type}/route.ts).
 *
 * BUG FIXED: this map previously used underscored keys
 * ("customer_support", "general_manager") that never matched the real
 * hyphenated type strings ("customer-support", "general-manager") passed in
 * by every caller (Website Chat, WhatsApp). Every inbound conversation
 * routed to a Customer Support or General Manager employee silently fell
 * through to the `default` case below and got the Receptionist agent
 * instead — the routed employee's own tools/instructions never ran, even
 * though conversationRouting/conversations correctly recorded the intended
 * employee. This was invisible in the UI (the conversation still showed the
 * "right" employee name) and had no test coverage before this pass.
 *
 * "custom" is deliberately NOT listed here — a Custom employee has no
 * static agent (see mastra/agents/custom.ts's createCustomAgent, built
 * per-employee from its own stored config/tool grants). Callers must
 * special-case "custom" themselves; getKubaAgent falls back to Receptionist
 * for it, matching every other unmodeled/unavailable case.
 */
// Mastra's Agent type is generic over its own literal `id` string, so a
// map spanning agents with different ids can't be typed narrower than
// `any` here without every entry fighting that literal-id mismatch — real
// type safety still lives inside each agent's own `new Agent({...})` call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const STATIC_AGENTS: Record<string, any> = {
  "receptionist": kubaReceptionistAgent,
  "sales": kubaSalesAgent,
  "customer-support": kubaCustomerSupportAgent,
  "general-manager": kubaGeneralManagerAgent,
  "outreach": kubaOutreachAgent,
  "marketing": kubaMarketingAgent,
  "appointment": kubaAppointmentAgent,
  "accountant": kubaAccountantAgent,
  "finance": kubaFinanceAgent,
  "hr": kubaHrAgent,
  "operations": kubaOperationsAgent,
};

export type KubaAgentType = keyof typeof STATIC_AGENTS | "custom";

/**
 * A minimal structural view of a Mastra Agent — just enough for every
 * caller here (which only ever calls `.generate(...)`) without pulling in
 * each agent's own literal `id`/tools type, which is what makes a plain
 * `Record<string, Agent<...>>` impossible to type across agents with
 * different ids. Method members are checked bivariantly in TypeScript, so
 * every real agent above is still a genuine structural match.
 */
export interface KubaAgentLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generate: (...args: any[]) => Promise<{ text?: string }>;
}

export function getKubaAgent(
  type: string,
): KubaAgentLike {
  const normalized = type.trim().toLowerCase();
  return STATIC_AGENTS[normalized] ?? kubaReceptionistAgent;
}
