import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import {
  businesses,
  aiBusinessSettings,
  aiEmployees,
  aiEmployeeSettings,
  conversations,
  messages,
  customers,
  leads,
  salesActivities,
} from "@/db/schema";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { formatDateTime, getBusinessLocalization } from "@/lib/localization";

export async function POST(request: Request) {
  try {
    // ---------------------------------------------------------
    // 1. Authenticate the user
    // ---------------------------------------------------------

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 },
      );
    }

    // ---------------------------------------------------------
    // 2. Read the request
    // ---------------------------------------------------------

    const body = await request.json();

    const message = String(
      body.message || "",
    ).trim();

    const conversationId = String(
      body.conversationId || "",
    ).trim();

    const employeeId = String(
      body.employeeId || "",
    ).trim();

    if (!message) {
      return NextResponse.json(
        {
          error: "Message is required.",
        },
        { status: 400 },
      );
    }

    if (!conversationId) {
      return NextResponse.json(
        {
          error: "Conversation ID is required.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // 3. Find the user's business
    // ---------------------------------------------------------

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    if (
      !membership ||
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.RECEPTION_AI,
      )
    ) {
      return NextResponse.json(
        { error: "You do not have permission to use the AI Receptionist." },
        { status: 403 },
      );
    }

    if (
      !hasCapability(
        await getBusinessEntitlements(business.id),
        "customer_ops.appointments",
      )
    ) {
      return NextResponse.json(
        {
          error: "The AI Receptionist requires a higher plan.",
          code: "FEATURE_NOT_ENTITLED",
          upgradeRequired: true,
        },
        { status: 403 },
      );
    }

    // ---------------------------------------------------------
    // 4. Load business AI settings
    // ---------------------------------------------------------

    const aiSettingsResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          business.id,
        ),
      )
      .limit(1);

    const aiSettings =
      aiSettingsResult[0];

    // ---------------------------------------------------------
    // 5. Load the AI Receptionist
    // ---------------------------------------------------------

    const receptionistResult = await db
      .select({
        employee: aiEmployees,
        settings: aiEmployeeSettings,
      })
      .from(aiEmployees)
      .leftJoin(
        aiEmployeeSettings,
        eq(
          aiEmployeeSettings.employeeId,
          aiEmployees.id,
        ),
      )
      .where(
        and(
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.status, "active"),
          employeeId
            ? eq(aiEmployees.id, employeeId)
            : eq(aiEmployees.type, "receptionist"),
        ),
      )
      .limit(10);

    const receptionist =
      receptionistResult.find(
        (item) =>
          item.employee.type ===
          "receptionist",
      );

    if (employeeId && !receptionist) {
      return NextResponse.json(
        {
          error:
            "This Receptionist employee is not active for your business.",
        },
        { status: 404 },
      );
    }

    const employeeSettings =
      receptionist?.settings;

    // ---------------------------------------------------------
    // 6. Business context
    // ---------------------------------------------------------

    const localization = await getBusinessLocalization(business.id);
    const nowInBusinessTimezone = formatDateTime(new Date(), localization.timezone, localization.locale);

    const businessContext = `
BUSINESS CONTEXT

You are working for the following business:

Business name: ${business.name}
Industry: ${
      business.industry ||
      "Not specified"
    }
Country: ${
      business.country ||
      "Not specified"
    }
Business size: ${
      business.businessSize ||
      "Not specified"
    }
Business status: ${business.status}

CURRENT DATE AND TIME

Business timezone: ${localization.timezone}
Current date and time in the business's timezone: ${nowInBusinessTimezone}

When the customer uses relative dates or times such as "today", "tomorrow",
"next week", or "2 PM", resolve them against the business timezone above —
never assume UTC or any other timezone. If the customer's intended date or
time is genuinely ambiguous, ask them to confirm rather than guessing.

BUSINESS KNOWLEDGE

Business description:
${
  aiSettings?.businessDescription ||
  "Not provided"
}

Products and services:
${
  aiSettings?.productsAndServices ||
  "Not provided"
}

Target customers:
${
  aiSettings?.targetCustomers ||
  "Not provided"
}

Frequently asked questions:
${
  aiSettings?.frequentlyAskedQuestions ||
  "Not provided"
}

COMMUNICATION STYLE

Tone:
${aiSettings?.tone || "professional"}

AI INSTRUCTIONS

${
  aiSettings?.aiInstructions ||
  "No additional instructions provided."
}

BEHAVIOR RULES

Use the business information above when answering customers.

Do not invent business information.

Do not claim that a service exists unless the business information supports it.

If you do not know something, say so clearly.

Ask for information that is genuinely needed.

Do not repeatedly ask for information the customer has already provided.

Follow the business's AI instructions while remaining helpful, accurate, and professional.
`;

    // ---------------------------------------------------------
    // 7. Employee context
    // ---------------------------------------------------------

    const employeeContext = `
AI EMPLOYEE ROLE

Employee name:
${
  receptionist?.employee.name ||
  "Kuba Receptionist"
}

Employee type:
${
  receptionist?.employee.type ||
  "receptionist"
}

Employee description:
${
  receptionist?.employee.description ||
  "Welcome customers and assist them with their requests."
}

ROLE INSTRUCTIONS

${
  employeeSettings?.roleInstructions ||
  "Welcome customers, understand their needs, answer common questions, and route requests appropriately."
}

GOALS

${
  employeeSettings?.goals ||
  "Provide helpful first-contact support and identify customer needs."
}

RESPONSIBILITIES

${
  employeeSettings?.responsibilities ||
  "Answer customer questions, capture useful information, and route requests."
}

PERSONALITY

${
  employeeSettings?.personality ||
  "Warm, professional, patient and helpful."
}

COMMUNICATION STYLE

${
  employeeSettings?.communicationStyle ||
  aiSettings?.tone ||
  "Professional and clear."
}

INFORMATION TO COLLECT

${
  employeeSettings?.informationToCollect ||
  "Collect useful customer information when relevant."
}

ESCALATION RULES

${
  employeeSettings?.escalationRules ||
  "Escalate situations that require human judgment or information not available to you."
}

HANDOFF RULES

${
  employeeSettings?.handoffRules ||
  "Route requests to the appropriate employee or human when necessary."
}

WORKING HOURS

${
  employeeSettings?.workingHours ||
  "Follow the business's normal operating hours when provided."
}

IMPORTANT

Follow the employee settings above while also following the business-level AI instructions.
`;

    // ---------------------------------------------------------
    // 8. Find or create the conversation
    // ---------------------------------------------------------

    const conversationResult = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, conversationId),
          eq(conversations.businessId, business.id),
        ),
      )
      .limit(1);

    let conversation =
      conversationResult[0];

    let customerId =
      conversation?.customerId ||
      null;

    // ---------------------------------------------------------
    // ---------------------------------------------------------
    // CUSTOMER INFORMATION EXTRACTION
      // ---------------------------------------------------------

      const extractedEmail =
        message.match(
          /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
        )?.[0] || null;

      const extractedPhone =
        message.match(
          /(?:\+?\d[\d\s().-]{7,}\d)/,
        )?.[0]?.trim() || null;

      const nameMatch = message.match(
          /(?:my name is|i am|this is)\s+([A-Za-z][A-Za-z .'-]{1,60}?)(?:\s+and\s+|\s*,|\.|!|$)/i,
        );

        const extractedName =
          nameMatch?.[1]
            ?.trim()
            .replace(/[.!?,]+$/, "")
            .trim() || null;

        console.log(
        "EXTRACTED CUSTOMER INFORMATION",
        {
          name: extractedName,
          email: extractedEmail,
          phone: extractedPhone,
        },
      );

      // 9. Find or create the customer
    // ---------------------------------------------------------
    // IMPORTANT:
    // A customer belongs to a conversation.
    // Never reuse the first customer belonging to the business.
    //
    // If this conversation already has a customer, use it.
    // If this is a new conversation, create a new customer.

    customerId =
      conversation?.customerId || null;

    // Reuse existing customer by email
    if (!customerId && extractedEmail) {
      const existingCustomer =
        await db
          .select()
          .from(customers)
          .where(
            and(
              eq(customers.businessId, business.id),
              eq(customers.email, extractedEmail),
            ),
          )
          .limit(1);

      if (existingCustomer[0]) {
        customerId = existingCustomer[0].id;
      }
    }

    if (!customerId) {
        const newCustomerId =
          crypto.randomUUID();

        const now = new Date();

        await db
          .insert(customers)
          .values({
            id: newCustomerId,
            businessId: business.id,
            name: extractedName,
            email: extractedEmail,
            phone: extractedPhone,
            source: "kuba_receptionist",
            createdAt: now,
            updatedAt: now,
          });

        customerId = newCustomerId;

        console.log(
          "NEW CUSTOMER CREATED",
          {
            customerId,
            name: extractedName,
            email: extractedEmail,
            phone: extractedPhone,
          },
        );
      } else {
        await db
          .update(customers)
          .set({
            ...(extractedName
              ? { name: extractedName }
              : {}),
            ...(extractedEmail
              ? { email: extractedEmail }
              : {}),
            ...(extractedPhone
              ? { phone: extractedPhone }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(customers.id, customerId),
              eq(customers.businessId, business.id),
            ),
          );

        console.log(
          "EXISTING CUSTOMER UPDATED",
          {
            customerId,
            name: extractedName,
            email: extractedEmail,
            phone: extractedPhone,
          },
        );
      }

      // ---------------------------------------------------------
      // 10. Create the conversation if necessary
    // ---------------------------------------------------------

    if (!conversation) {
      const now = new Date();

      await db
        .insert(conversations)
        .values({
          id: conversationId,
          businessId: business.id,
          customerId,
          integrationId: "dashboard",
          externalConversationId:
            conversationId,
          customerName: null,
          customerPhone: null,
          customerEmail: null,
          assignedEmployeeId:
            receptionist?.employee
              .id || null,
          status: "open",
          createdAt: now,
          updatedAt: now,
        });

      const createdConversation =
        await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(conversations.id, conversationId),
              eq(conversations.businessId, business.id),
            ),
          )
          .limit(1);

      conversation =
        createdConversation[0];
    } else if (
      !conversation.customerId &&
      customerId
    ) {
      await db
        .update(conversations)
        .set({
          customerId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(conversations.id, conversationId),
            eq(conversations.businessId, business.id),
          ),
        );
    }

    // ---------------------------------------------------------
    // 11. Save customer's message
    // ---------------------------------------------------------

    await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        businessId: business.id,
        conversationId,
        integrationId: "dashboard",
        externalMessageId: null,
        direction: "inbound",
        senderType: "customer",
        senderId: null,
        content: message,
        messageType: "text",
        createdAt: new Date(),
      });

    // ---------------------------------------------------------
    // 12. Load conversation history
    // ---------------------------------------------------------

    const previousMessages =
      await db
        .select({
          direction:
            messages.direction,
          senderType:
            messages.senderType,
          content:
            messages.content,
        })
        .from(messages)
        .where(
          eq(
            messages.conversationId,
            conversationId,
          ),
        )
        .orderBy(
          messages.createdAt,
        );

    const conversationHistory =
      previousMessages
        .slice(-20)
        .map((item) => {
          const speaker =
            item.senderType ===
            "customer"
              ? "CUSTOMER"
              : "KUBA RECEPTIONIST";

          return `${speaker}: ${item.content}`;
        })
        .join("\n\n");

    // ---------------------------------------------------------
    // 13. Build AI prompt
    // ---------------------------------------------------------

    const prompt = `${businessContext}

${employeeContext}

CONVERSATION HISTORY

${
  conversationHistory ||
  "No previous conversation."
}

CONVERSATION MEMORY RULES

Use the conversation history as memory.

Remember information the customer has already provided.

Do not ask the customer for information they have already provided.

If the customer has already given their name, do not ask for their name again.

If the customer has already given their email, do not ask for their email again.

If the customer has already given their phone number, do not ask for their phone number again.

Identify which information is already known.

IMPORTANT CUSTOMER HANDLING RULES:
- Never ask for information that the customer already provided.
- If name and email are provided, acknowledge them.
- Do not repeat a full service list unless the customer asks.
- If the customer says they are interested in services but has not chosen one, ask a single simple question:
  "Which service would you like help with?"

- When a customer has already identified a service:
  - Acknowledge the service.
  - Ask only the most important next qualification question.
  - Do not request multiple pieces of information in one message.

- For study abroad or student visa enquiries, collect information gradually:
  1. Study level or program.
  2. Preferred study country or university destination.
  3. Preferred intake timing.
  4. Contact phone number.

- If the customer already provided their study level or program, do not ask for it again.
- If the customer already provided their destination, do not ask for it again.
- Always ask only for the next missing qualification detail.

- Collect missing information naturally over the conversation.
- Do not ask for destination, purpose, phone number, and dates all at once.

Ask only for information that is still missing and genuinely relevant to the customer's request.

Identify the customer's intended service, such as visa assistance, study abroad, flight booking, or travel consultation.

Use the requirements appropriate to that service.

Do not ask study-abroad customers for flight-booking information unless it is actually relevant.

Keep the conversation natural.

CURRENT CUSTOMER REQUEST

${message}`;

    // ---------------------------------------------------------
    // 14. Generate Kuba's response
    // ---------------------------------------------------------

      // ---------------------------------------------------------
      // ---------------------------------------------------------
      // LEAD INTELLIGENCE EXTRACTION
      // ---------------------------------------------------------
      //
      // Convert the customer's natural-language request into
      // structured CRM information.
      //

      let extractedService = null;
      let extractedDestination = null;
      let extractedIntent = null;
      let extractedNotes = null;

      const lowerMessage =
        message.toLowerCase();

      // Study abroad
      if (
        lowerMessage.includes("study in") ||
        lowerMessage.includes("studying in") ||
        lowerMessage.includes("study abroad") ||
        lowerMessage.includes("study abroad opportunities") ||
        lowerMessage.includes("university") ||
        lowerMessage.includes("college admission") ||
        lowerMessage.includes("school admission")
      ) {
        extractedService =
          "study_abroad";

        extractedIntent =
          message.trim();

        const destinationMatch =
          message.match(
            /(?:study|studying|study abroad|admission|university).*?\b(?:in|to)\s+([A-Za-z][A-Za-z -]{2,40})/i
          );

        if (destinationMatch?.[1]) {
          extractedDestination =
            destinationMatch[1]
              .trim()
              .replace(/[.!?,]+$/, "");
        }

        extractedNotes =
          "Customer is interested in study abroad opportunities.";
      }

      // Visa assistance
      else if (
        lowerMessage.includes("visa") ||
        lowerMessage.includes("visa assistance") ||
        lowerMessage.includes("visa application")
      ) {
        extractedService =
          "visa_assistance";

        extractedIntent =
          message.trim();

        const visaDestinationMatch =
          message.match(
            /(?:visa|travel|move|go|visit|work|study).*?\b(?:to|in)\s+([A-Za-z][A-Za-z -]{2,40})/i
          );

        if (visaDestinationMatch?.[1]) {
          extractedDestination =
            visaDestinationMatch[1]
              .trim()
              .replace(/[.!?,]+$/, "");
        }

        extractedNotes =
          "Customer is interested in visa assistance.";
      }

      // Flight booking
      else if (
        lowerMessage.includes("flight") ||
        lowerMessage.includes("flight booking") ||
        lowerMessage.includes("book a flight") ||
        lowerMessage.includes("air ticket") ||
        lowerMessage.includes("plane ticket")
      ) {
        extractedService =
          "flight_booking";

        extractedIntent =
          message.trim();

        extractedNotes =
          "Customer is interested in flight booking.";
      }

      // Travel consultation
      else if (
        lowerMessage.includes("travel consultation") ||
        lowerMessage.includes("travel advice") ||
        lowerMessage.includes("travel planning") ||
        lowerMessage.includes("travel assistance")
      ) {
        extractedService =
          "travel_consultation";

        extractedIntent =
          message.trim();

        extractedNotes =
          "Customer is interested in travel consultation.";
      }

      else if (
        lowerMessage.includes("interested") ||
        lowerMessage.includes("your services") ||
        lowerMessage.includes("need help") ||
        lowerMessage.includes("want to know more")
      ) {
        extractedService =
          "general_inquiry";

        extractedIntent =
          message.trim();

        extractedNotes =
          "Customer expressed general interest in business services.";
      }

      console.log(
        "EXTRACTED LEAD INTELLIGENCE",
        {
          service:
            extractedService,
          destination:
            extractedDestination,
          intent:
            extractedIntent,
          notes:
            extractedNotes,
        },
      );

      // ---------------------------------------------------------
      // ---------------------------------------------------------
      // ADVANCED LEAD INTELLIGENCE EXTRACTION
      // ---------------------------------------------------------

      let extractedStudyLevel = null;
      let extractedProgram = null;
      let extractedUniversity = null;
      let extractedPreferredIntake = null;
      let extractedBudget = null;

      // Study level
      const studyLevelMatch = message.match(
        /\b(PhD|Ph\.D\.?|Doctorate|Doctoral|Master'?s|MBA|MSc|MA|Bachelor'?s|BSc|BA|Diploma|Certificate|Undergraduate|Postgraduate)\b/i
      );

      if (studyLevelMatch?.[1]) {
        extractedStudyLevel = studyLevelMatch[1].trim();
      }

      // Program / field of study
      let programMatch = message.match(
        /(?:Master'?s|Bachelor'?s|MBA|MSc|MA|BSc|BA|PhD|Doctorate)\s+(?:degree\s+)?(?:in|of)\s+([A-Za-z][A-Za-z &/'-]{2,80})(?=\s+(?:at|in|for|starting|beginning|from|with)|\s*[,.!?]|$)/i
      );

      if (!programMatch) {
        programMatch = message.match(
          /(?:program(?:me)?|course|degree|field of study)\s+(?:in|of)?\s*([A-Za-z][A-Za-z &/'-]{2,80})(?=\s+(?:at|in|for|starting|beginning|from|with)|\s*[,.!?]|$)/i
        );
      }

      if (programMatch?.[1]) {
        extractedProgram = programMatch[1]
          .trim()
          .replace(/[,.!?]+$/, "")
          .trim();
      }

      // University / institution
      const universityMatch = message.match(
        /(?:at|university(?:\s+of)?|college(?:\s+of)?|school)\s+([A-Za-z][A-Za-z0-9 &'.,-]{2,100})(?=\s+(?:in|for|starting|beginning|from|with)|\s*[,.!?]|$)/i
      );

      if (universityMatch?.[1]) {
        extractedUniversity = universityMatch[1]
          .trim()
          .replace(/[,.!?]+$/, "")
          .trim();
      }

      // Preferred intake
      const intakeMatch = message.match(
        /(?:start|starting|begin|beginning|intake|admission).*?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s*([0-9]{4})?/i
      );

      if (intakeMatch?.[1]) {
        extractedPreferredIntake =
          intakeMatch[1] +
          (intakeMatch[2] ? " " + intakeMatch[2] : "");
      }

      // Also support "September 2027 intake"
      if (!extractedPreferredIntake) {
        const directIntakeMatch = message.match(
          /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+([0-9]{4})\s+intake\b/i
        );

        if (directIntakeMatch?.[1]) {
          extractedPreferredIntake =
            directIntakeMatch[1] +
            " " +
            directIntakeMatch[2];
        }
      }

      // Budget
      const budgetMatch = message.match(
        /(?:budget|afford|can spend|willing to spend|have).*?([€$£]|GHS|USD|EUR|GBP)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*(k|thousand|million))?/i
      );

      if (budgetMatch?.[2]) {
        const currency = budgetMatch[1] || "";
        const amount = budgetMatch[2];
        const multiplier = budgetMatch[3]
          ? " " + budgetMatch[3]
          : "";

        extractedBudget =
          (currency + " " + amount + multiplier).trim();
      }

      console.log(
        "EXTRACTED ADVANCED LEAD INFORMATION",
        {
          studyLevel: extractedStudyLevel,
          program: extractedProgram,
          university: extractedUniversity,
          preferredIntake: extractedPreferredIntake,
          budget: extractedBudget,
        },
      );

      // LEAD CREATION AND UPDATE
      // ---------------------------------------------------------
      // One customer = one lead.
      // Later messages update the same lead.

      let lead = null;

      if (customerId) {
        const existingLeadResult =
          await db
            .select()
            .from(leads)
            .where(
              and(
                eq(leads.customerId, customerId),
                eq(leads.businessId, business.id),
              ),
            )
            .limit(1);

        lead =
          existingLeadResult[0] || null;
      }

      if (!lead) {
        const newLeadId =
          crypto.randomUUID();

        const now = new Date();

        await db
          .insert(leads)
          .values({
            id: newLeadId,
            businessId: business.id,
            customerId,
            name: extractedName,
            email: extractedEmail,
            phone: extractedPhone,
            service: extractedService,
            destination:
              extractedDestination,
            intent:
              extractedIntent,
            notes:
              extractedNotes,
            studyLevel:
              extractedStudyLevel,
            program:
              extractedProgram,
            university:
              extractedUniversity,
            preferredIntake:
              extractedPreferredIntake,
            budget:
              extractedBudget,
            source:
              "kuba_receptionist",
            stage: "new",
            assignedEmployeeId:
              receptionist?.employee.id ||
              null,
            createdAt: now,
            updatedAt: now,
          });

        console.log(
          "NEW LEAD CREATED",
          {
            leadId: newLeadId,
            customerId,
            name: extractedName,
            email: extractedEmail,
            phone: extractedPhone,
          },
        );

        await db
          .insert(salesActivities)
          .values({
            id: crypto.randomUUID(),
            businessId:
              business.id,
            leadId: newLeadId,
            employeeId:
              receptionist?.employee.id ||
              null,
            type:
              "lead_created",
            title:
              "Lead captured by Kuba Receptionist",
            description:
              message,
            createdAt: now,
          });

        const createdLeadResult =
          await db
            .select()
            .from(leads)
            .where(
              eq(
                leads.id,
                newLeadId,
              ),
            )
            .limit(1);

        lead =
          createdLeadResult[0] || null;
      } else {
        const updatedName =
          extractedName ||
          lead.name ||
          null;

        const updatedEmail =
          extractedEmail ||
          lead.email ||
          null;

        const updatedPhone =
          extractedPhone ||
          lead.phone ||
          null;

        await db
          .update(leads)
          .set({
            name: updatedName,
            email: updatedEmail,
            phone: updatedPhone,
            service:
              extractedService ||
              lead.service ||
              null,
            destination:
              extractedDestination ||
              lead.destination ||
              null,
            intent:
              extractedIntent ||
              lead.intent ||
              null,
            notes:
              extractedNotes ||
              lead.notes ||
              null,
            studyLevel:
              extractedStudyLevel ||
              lead.studyLevel ||
              null,
            program:
              extractedProgram ||
              lead.program ||
              null,
            university:
              extractedUniversity ||
              lead.university ||
              null,
            preferredIntake:
              extractedPreferredIntake ||
              lead.preferredIntake ||
              null,
            budget:
              extractedBudget ||
              lead.budget ||
              null,
            customerId,
            updatedAt:
              new Date(),
          })
          .where(
            and(
              eq(leads.id, lead.id),
              eq(leads.businessId, business.id),
            ),
          );

        console.log(
          "EXISTING LEAD UPDATED",
          {
            leadId: lead.id,
            customerId,
            name: updatedName,
            email: updatedEmail,
            phone: updatedPhone,
          },
        );
      }



    const receptionistPrompt = `
CUSTOMER MESSAGE:
${message}

CONVERSATION CONTEXT:
${prompt}
`;

    console.log(
      "RECEPTIONIST BUSINESS CONTEXT",
      {
        businessId: business.id,
        conversationId,
      },
    );

    console.log("ABOUT TO CALL KUBA AGENT", {
      businessId: business.id,
      conversationId,
      promptLength: receptionistPrompt.length,
    });

    console.log(
      "STARTING KUBA RECEPTIONIST AI GENERATION",
      {
        businessId: business.id,
        promptLength: receptionistPrompt.length,
      },
    );

    const result =
      await kubaReceptionistAgent.generate(
        receptionistPrompt,
        {
          requestContext: new RequestContext([["businessId", business.id]]),
        },
      );

    console.log(
      "KUBA RECEPTIONIST AI RESPONSE GENERATED",
      {
        textLength: result.text.length,
        text: result.text,
      },
    );

    console.log("KUBA AGENT COMPLETED", {
      responseLength: result.text?.length,
    });

    // ---------------------------------------------------------
    // 15. Save Kuba's response
    // ---------------------------------------------------------

    await db
      .insert(messages)
      .values({
        id: crypto.randomUUID(),
        businessId: business.id,
        conversationId,
        integrationId: "dashboard",
        externalMessageId: null,
        direction: "outbound",
        senderType: "ai_employee",
        senderId:
          receptionist?.employee
            .id || null,
        content: result.text,
        messageType: "text",
        createdAt: new Date(),
      });

    // ---------------------------------------------------------
    // 16. Return response
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,
      response: result.text,
      conversationId,
      customerId,
    });
  } catch (error) {
    console.error(
      "KUBA RECEPTIONIST FULL ERROR:",
      JSON.stringify(
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : error,
        null,
        2,
      ),
    );

    return NextResponse.json(
      {
        error:
          "Kuba Receptionist was unable to respond.",
      },
      { status: 500 },
    );
  }
}
