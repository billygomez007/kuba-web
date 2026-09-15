import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";

import {
  businesses,
  aiEmployees,
  aiBusinessSettings,
} from "@/db/schema";

import { kubaAppointmentAgent } from "@/mastra/agents/appointment";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/ai/model-config";
import { classifyAIProviderError } from "@/lib/ai/provider-error";
import { withAIUsageLogging } from "@/lib/ai/usage-logging";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    const body = await request.json();
    const message = String(body.message || "").trim();
    const employeeId = String(body.employeeId || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with your account." },
        { status: 404 },
      );
    }

    if (!isEmployeeTypeEntitled(await getBusinessEntitlements(business.id), "appointment")) {
      return NextResponse.json(
        {
          error: "Kuba Appointment requires the Pro plan or higher.",
          code: "EMPLOYEE_TYPE_NOT_ENTITLED",
          upgradeRequired: true,
        },
        { status: 403 },
      );
    }

    const employeeResult = await db
      .select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, employeeId),
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.type, "appointment"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const employee = employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        { error: "This Appointment employee is not active for your business." },
        { status: 404 },
      );
    }

    const businessKnowledgeResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(eq(aiBusinessSettings.businessId, business.id))
      .limit(1);

    const knowledge = businessKnowledgeResult[0];

    const businessContext = `
BUSINESS CONTEXT

Business name:
${business.name}

Industry:
${business.industry || "Not specified"}

Country:
${business.country || "Not specified"}

Business status:
${business.status}


STRUCTURED BUSINESS KNOWLEDGE

Business Description:
${knowledge?.businessDescription || "Not provided"}

Products and Services:
${knowledge?.productsAndServices || "Not provided"}

Communication Tone:
${knowledge?.tone || "professional"}


APPOINTMENT EMPLOYEE

Employee name:
${employee.name}

Employee ID:
${employee.id}

Only use information belonging to this business. Never invent an
appointment, a time slot, or availability. If information is unavailable,
say so clearly.

CURRENT DATE AND TIME

${new Date().toISOString()}
`;

    const prompt = `
${businessContext}


APPOINTMENT REQUEST

${message}


APPOINTMENT RESPONSE RULES

- Always check the calendar before proposing or confirming a time.
- Never claim a booking, reschedule, or cancellation happened unless the tool result confirms it.
- Confirm the final date, time, and timezone back to the user.
- The business owner remains the final decision maker.
`;

    const result = await withAIUsageLogging(
      {
        feature: "appointment",
        businessId: business.id,
        employeeId: employee.id,
        model: DEFAULT_CHAT_MODEL_ID,
      },
      () =>
        kubaAppointmentAgent.generate(prompt, {
          memory: {
            resource: session.user.id,
            thread: `appointment-${employee.id}`,
          },
          requestContext: new RequestContext([
            ["businessId", business.id],
            ["employeeId", employee.id],
          ]),
        }),
    );

    return NextResponse.json({
      success: true,
      employee: { id: employee.id, name: employee.name },
      response: result.text,
    });
  } catch (error) {
    console.error("Kuba Appointment error:", error, { category: classifyAIProviderError(error) });

    return NextResponse.json({ error: "Kuba Appointment was unable to respond." }, { status: 500 });
  }
}
