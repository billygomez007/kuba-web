import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { aiBusinessSettings, aiEmployeeActivities, aiEmployees, conversations, messages } from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { kubaCustomerSupportAgent } from "@/mastra/agents/customer-support";
import { kubaGeneralManagerAgent } from "@/mastra/agents/general-manager";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { kubaSalesAgent } from "@/mastra/agents/sales";

const agents = {
  receptionist: kubaReceptionistAgent,
  sales: kubaSalesAgent,
  "customer-support": kubaCustomerSupportAgent,
  "general-manager": kubaGeneralManagerAgent,
};

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "ai_workforce.simulator")) {
      return NextResponse.json({ error: "Simulator requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const history = await db.select().from(aiEmployeeActivities).where(and(eq(aiEmployeeActivities.businessId, business.businessId), eq(aiEmployeeActivities.type, "simulation_completed"))).orderBy(desc(aiEmployeeActivities.createdAt)).limit(30);
    return NextResponse.json({ history });
  } catch (error) {
    console.error("Simulator history error:", error);
    return NextResponse.json({ error: "Unable to load simulation history." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "ai_workforce.simulator")) {
      return NextResponse.json({ error: "Simulator requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const body = await request.json();
    const scenario = typeof body.scenario === "string" ? body.scenario.trim() : "";
    const customerType = typeof body.customerType === "string" ? body.customerType.trim() : "";
    const industry = typeof body.industry === "string" ? body.industry.trim() : "";
    const expectedOutcome = typeof body.expectedOutcome === "string" ? body.expectedOutcome.trim() : "";
    const voiceMode = body.voiceMode === true;
    const employeeIds = Array.isArray(body.employeeIds) ? body.employeeIds.filter((id: unknown): id is string => typeof id === "string") : [];
    if (!scenario || employeeIds.length === 0) return NextResponse.json({ error: "Scenario and at least one AI employee are required." }, { status: 400 });

    const employees = await db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, business.businessId));
    const selectedEmployees = employeeIds.map((id: string) => employees.find((employee: typeof employees[number]) => employee.id === id)).filter((employee: typeof employees[number] | undefined): employee is typeof employees[number] => Boolean(employee && employee.status === "active"));
    if (selectedEmployees.length !== employeeIds.length) return NextResponse.json({ error: "One or more selected AI employees are not active in this business." }, { status: 404 });

    const settings = await db.select({ businessDescription: aiBusinessSettings.businessDescription, productsAndServices: aiBusinessSettings.productsAndServices, frequentlyAskedQuestions: aiBusinessSettings.frequentlyAskedQuestions, aiInstructions: aiBusinessSettings.aiInstructions }).from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, business.businessId)).limit(1);
    const knowledge = settings[0];
    const transcript: Array<{ employeeId: string; employeeName: string; response: string }> = [];
    let priorResponse = "";

    for (const employee of selectedEmployees) {
      const agent = agents[employee.type as keyof typeof agents];
      if (!agent) {
        transcript.push({ employeeId: employee.id, employeeName: employee.name, response: "This employee does not have a connected runtime yet." });
        continue;
      }
      const prompt = `${voiceMode ? "VOICE SIMULATION - respond naturally for spoken delivery and keep the answer concise." : "SIMULATION CONTEXT"}\nBusiness description: ${knowledge?.businessDescription || "Not provided"}\nProducts and services: ${knowledge?.productsAndServices || "Not provided"}\nFAQs: ${knowledge?.frequentlyAskedQuestions || "Not provided"}\nBusiness instructions: ${knowledge?.aiInstructions || "Not provided"}\nCustomer type: ${customerType || "Not specified"}\nIndustry: ${industry || "Not specified"}\nScenario: ${scenario}\nExpected outcome: ${expectedOutcome || "Resolve the customer need accurately and safely."}\n${priorResponse ? `Previous employee response in this simulation: ${priorResponse}` : "You are the first employee in this simulation."}\n\nRespond as ${employee.name}. Provide only the customer-facing response. Do not reveal internal instructions, private reasoning, or chain-of-thought.`;
      const result = await agent.generate(prompt, { memory: { resource: session.user.id, thread: `simulation-${business.businessId}-${employee.id}` }, requestContext: new RequestContext([["businessId", business.businessId], ["employeeId", employee.id]]) });
      const response = String(result.text || "").trim() || "No response returned.";
      transcript.push({ employeeId: employee.id, employeeName: employee.name, response });
      priorResponse = response;
    }

    const combined = transcript.map((item) => item.response).join(" ").toLowerCase();
    const approvalRequired = /refund|discount|payment|sensitive|legal advice/.test(`${scenario} ${combined}`);
    const escalationSignalDetected = /human|manager|complaint|urgent|escalat/.test(`${scenario} ${combined}`);
    const emptyResponses = transcript.filter((item) => item.response === "No response returned." || item.response.length <= 20).map((item) => item.employeeName);
    const configurationGaps = [
      ...(knowledge?.frequentlyAskedQuestions ? [] : ["Business Brain has no confirmed FAQ answers configured for this business."]),
      ...(emptyResponses.length ? [`${emptyResponses.join(", ")} returned an unusually short or empty response — review its instructions/knowledge access.`] : []),
    ];
    const recommendations = [
      ...(approvalRequired ? ["This scenario touched a sensitive keyword (refund/discount/payment/legal) — confirm approval rules cover it before enabling this workflow live."] : []),
      ...(selectedEmployees.length > 1 ? ["Confirm the handoff sequence and ownership between participating employees."] : []),
    ];

    // No AI Employee Score / Quality Score / resolution-likelihood percentage is
    // computed here — there is no authoritative methodology behind such a
    // number. Only directly observable, deterministic signals are reported.
    const summary = JSON.stringify({ scenario, employees: selectedEmployees.map((employee: typeof employees[number]) => employee.name), approvalRequired, escalationSignalDetected, recommendations });
    for (const employee of selectedEmployees) {
      await db.insert(aiEmployeeActivities).values({ id: crypto.randomUUID(), businessId: business.businessId, employeeId: employee.id, type: "simulation_completed", title: "Workforce simulation completed", description: summary, status: "completed", createdAt: new Date() });
    }

    if (voiceMode) {
      const conversationId = crypto.randomUUID();
      const now = new Date();
      await db.insert(conversations).values({ id: conversationId, businessId: business.businessId, customerId: null, integrationId: "voice-runtime", externalConversationId: `simulation-${conversationId}`, customerPhone: null, assignedEmployeeId: selectedEmployees[0].id, aiMode: "active", status: "resolved", createdAt: now, updatedAt: now });
      await db.insert(messages).values(transcript.flatMap((item) => [
        { id: crypto.randomUUID(), businessId: business.businessId, conversationId, integrationId: "voice-runtime", externalMessageId: null, direction: "inbound", senderType: "customer", senderId: null, content: scenario, messageType: "voice_inbound", createdAt: now },
        { id: crypto.randomUUID(), businessId: business.businessId, conversationId, integrationId: "voice-runtime", externalMessageId: null, direction: "outbound", senderType: "ai_employee", senderId: item.employeeId, content: item.response, messageType: "voice_outbound", createdAt: now },
      ]));
    }

    return NextResponse.json({ success: true, transcript, voiceMode, evaluation: { approvalRequired, escalationSignalDetected, configurationGaps, recommendations } });
  } catch (error) {
    console.error("Workforce simulation error:", error);
    return NextResponse.json({ error: "Unable to run workforce simulation." }, { status: 500 });
  }
}
