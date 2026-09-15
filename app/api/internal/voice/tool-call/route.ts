import { NextResponse } from "next/server";

import { requireGatewayInternalAuth } from "@/lib/voice/internal-auth";
import { getActiveEmployee } from "@/lib/voice/employee-lookup";
import { findVoiceTool } from "@/lib/voice/voice-tools";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

/**
 * Internal-only (Phase 20-21): the ONLY place a Voice Gateway-forwarded
 * OpenAI Realtime tool call can actually execute business logic. Three
 * gates, all mandatory, in order:
 *  1. requireGatewayInternalAuth — proves this is the gateway, for a
 *     specific verified session (businessId/employeeId from the token).
 *  2. findVoiceTool — the tool must be in the small, hand-picked
 *     lib/voice/voice-tools.ts allowlist for this employee's type; an
 *     unlisted/unknown tool name is refused outright, never guessed at.
 *  3. checkAIEmployeeAuthority — the SAME centralized policy gate every
 *     other AI tool call in this codebase goes through, including its
 *     "requires_approval" outcome. A voice conversation grants no
 *     additional trust — an action that would need human approval from
 *     a text conversation still needs it here; this endpoint returns
 *     that outcome rather than executing, so the AI can tell the caller
 *     appropriately (Phase 21) instead of silently doing the thing.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const auth = requireGatewayInternalAuth(request, body.token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { businessId, employeeId } = auth.claims;
  const employee = await getActiveEmployee(businessId, employeeId);
  if (!employee) return NextResponse.json({ ok: false, message: "This AI employee is not available." }, { status: 404 });

  const toolName = typeof body.toolName === "string" ? body.toolName : "";
  const tool = findVoiceTool(toolName);
  if (!tool || !tool.employeeTypes.includes(employee.employee.type)) {
    return NextResponse.json({ ok: false, message: "This action is not available on a voice call." });
  }

  const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: tool.action });
  if (!decision.ok) {
    return NextResponse.json({ ok: false, message: decision.message, reason: decision.reason });
  }

  const args = typeof body.arguments === "object" && body.arguments !== null ? body.arguments : {};
  try {
    const result = await tool.execute(businessId, employeeId, args);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ ok: false, message: "Unable to complete this action right now." });
  }
}
