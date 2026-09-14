import { openai } from "@ai-sdk/openai";

/**
 * Single source of truth for every OpenAI model identifier this app uses.
 * These are the ACTUAL model choices already in production use as of this
 * audit — this file centralizes them, it does not change them. An
 * environment override is provided for operational flexibility (e.g.
 * swapping models without a code deploy during a provider incident), but
 * every default below is exactly what the code already called directly
 * before this file existed.
 *
 * Categories reflect the real, current distinctions in this codebase, not
 * every category a larger app might eventually need — there is currently
 * only one conversational-agent model and one lighter internal-analysis
 * model, so DEFAULT_CHAT_MODEL_ID and EXECUTIVE_MODEL_ID are the only two
 * chat categories. Do not add REASONING_MODEL/FAST_CHAT_MODEL/OUTREACH_MODEL
 * etc. constants that would just duplicate one of these two values — that
 * invents a distinction the product doesn't actually have yet.
 */

/**
 * Used by every conversational Mastra agent: Receptionist, Sales, Customer
 * Support, General Manager, Outreach, and the Outreach Researcher. This is
 * the model that talks to real customers and makes tool calls, so it is
 * intentionally the stronger of the two chat models.
 */
export const DEFAULT_CHAT_MODEL_ID =
  process.env.AI_DEFAULT_CHAT_MODEL || "gpt-4o";

/**
 * Used for internal, non-customer-facing analysis/summarization only: the
 * Executive Briefing (GET /api/command-center/briefing) and the Command
 * Center free-text Q&A (POST /api/ai/command-center). Deliberately a
 * cheaper/faster model — these are short, structured, low-stakes summaries
 * over data the caller already has, not open-ended customer conversations.
 */
export const EXECUTIVE_MODEL_ID =
  process.env.AI_EXECUTIVE_MODEL || "gpt-4o-mini";

/**
 * OpenAI Realtime API model for voice. Already had its own environment
 * override before this file existed (lib/voice/adapters/openai-realtime.ts)
 * — kept as the single source of truth for that default here too, so a
 * future caller doesn't have to know to look in the voice adapter file.
 */
export const REALTIME_MODEL_ID =
  process.env.OPENAI_REALTIME_MODEL || "gpt-realtime";

/** Default voice for the Realtime API — same existing override, centralized. */
export const REALTIME_VOICE =
  process.env.OPENAI_REALTIME_VOICE || "alloy";

/**
 * No embedding model is currently used anywhere in this codebase — Business
 * Brain / knowledge search (lib/knowledge/search.ts) is word-based, not
 * vector-based. This constant is intentionally left undefined rather than
 * pre-filled with a value nothing calls, so it can't silently start looking
 * "already configured" to a future reader. Add EMBEDDING_MODEL_ID here only
 * when a real embedding call is introduced.
 */
export const EMBEDDING_MODEL_ID: string | undefined = undefined;

export function defaultChatModel() {
  return openai(DEFAULT_CHAT_MODEL_ID);
}

export function executiveModel() {
  return openai(EXECUTIVE_MODEL_ID);
}
