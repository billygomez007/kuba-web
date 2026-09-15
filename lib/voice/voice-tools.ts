import { RequestContext } from "@mastra/core/request-context";

import { getBusinessKnowledgeTool } from "@/mastra/tools/get-business-knowledge";
import type { AIAction } from "@/lib/ai/authority";

/**
 * The deliberately minimal, hand-picked allowlist of tools a live voice
 * session may call (Phase 20-21). Each entry wraps an EXISTING Mastra
 * tool unchanged — never a parallel reimplementation — so every safety
 * check that tool already enforces (checkAIEmployeeAuthority, including
 * its "requires_approval" outcome) applies identically to a voice call
 * as it does to a text conversation. Widening this list to any
 * state-changing tool is a distinct future decision requiring its own
 * safety review, not something to default to while building the
 * gateway's plumbing.
 */
export interface VoiceToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  employeeTypes: string[];
  /** The checkAIEmployeeAuthority action this tool is authorized under — never guessed at call time, one fixed action per allowlisted tool. */
  action: AIAction;
  execute: (businessId: string, employeeId: string, args: Record<string, unknown>) => Promise<unknown>;
}

export const VOICE_TOOL_DEFINITIONS: VoiceToolDefinition[] = [
  {
    name: "get_business_knowledge",
    description: "Retrieve the company's business profile, products, customers, FAQs, instructions, and communication style. Use this before giving business-specific recommendations.",
    parameters: { type: "object", properties: {}, required: [] },
    employeeTypes: ["receptionist", "sales", "customer-support", "general-manager"],
    action: "read_business_knowledge",
    async execute(businessId, employeeId) {
      const requestContext = new RequestContext([["businessId", businessId], ["employeeId", employeeId]]);
      // getBusinessKnowledgeTool.execute is typed optional (Mastra's Tool
      // type allows a tool with no execute at all) and its RequestContext
      // generic is inferred narrower than this direct-call site provides
      // — both are Mastra typing artifacts of calling a tool outside its
      // normal agent-orchestrated path, not a real type mismatch (this
      // exact RequestContext shape already works when passed to
      // agent.generate() in app/api/voice/calls/route.ts's "turn" action).
      if (!getBusinessKnowledgeTool.execute) throw new Error("get-business-knowledge tool has no execute function.");
      return getBusinessKnowledgeTool.execute({}, { requestContext } as never);
    },
  },
];

export function findVoiceTool(name: string): VoiceToolDefinition | undefined {
  return VOICE_TOOL_DEFINITIONS.find((tool) => tool.name === name);
}
