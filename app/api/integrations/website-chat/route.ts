import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";
import { randomBytes } from "node:crypto";

import { db } from "@/db";

import {
  businesses,
  aiBusinessSettings,
  aiEmployees,
  integrations,
  conversations,
  messages,
  conversationRouting,
} from "@/db/schema";

import { routeConversationToTeam } from "@/lib/communications/team-router";
import { type ConversationDepartment } from "@/lib/communications/routing";
import { routeConversation } from "@/lib/communications/router";
import { getKubaAgent } from "@/lib/communications/ai-agent-registry";
import { resolveEmployeeForDepartment } from "@/lib/communications/handoff";
import { searchKnowledge } from "@/lib/knowledge/search";
import { runAutomationTrigger } from "@/lib/automations/engine";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeImplementationAvailable, isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";
import {
  type WebsiteChatMetadata,
  parseWebsiteChatMetadata,
  normalizeDomain,
} from "@/lib/integrations/website-chat-config";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/ai/model-config";
import { classifyAIProviderError } from "@/lib/ai/provider-error";
import { withAIUsageLogging } from "@/lib/ai/usage-logging";


function classifyWebsiteChatError(
  error: unknown,
) {
  const messages: string[] = [];
  let current:
    unknown = error;

  for (
    let depth = 0;
    depth < 4 && current;
    depth += 1
  ) {
    if (current instanceof Error) {
      messages.push(
        current.message.toLowerCase(),
      );
    }

    current =
      typeof current === "object" &&
      current !== null &&
      "cause" in current
        ? current.cause
        : null;
  }

  const message =
    messages.join(" ");

  if (
    message.includes(
      "not null constraint failed",
    )
  ) {
    return "not_null_constraint";
  }

  if (
    message.includes(
      "foreign key constraint failed",
    )
  ) {
    return "foreign_key_constraint";
  }

  if (
    message.includes(
      "unique constraint failed",
    )
  ) {
    return "unique_constraint";
  }

  if (
    message.includes("no such table")
  ) {
    return "missing_table";
  }

  if (
    message.includes("no such column") ||
    message.includes(
      "has no column named",
    )
  ) {
    return "missing_column";
  }

  return "database_or_provider_error";
}

function getWebsiteChatDriverCode(
  error: unknown,
) {
  let current:
    unknown = error;

  for (
    let depth = 0;
    depth < 4 && current;
    depth += 1
  ) {
    if (
      typeof current === "object" &&
      current !== null
    ) {
      const record =
        current as Record<
          string,
          unknown
        >;

      for (const field of [
        "code",
        "rawCode",
      ] as const) {
        const value =
          field in record
            ? record[field]
            : null;

        if (
          typeof value === "string" &&
          /^[A-Z][A-Z0-9_]{1,63}$/.test(
            value,
          )
        ) {
          return value;
        }
      }

      current =
        "cause" in record
          ? record.cause
          : null;
    } else {
      current = null;
    }
  }

  return null;
}


export async function GET() {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const {
      hasPermission,
      PERMISSIONS,
    } = await import("@/lib/auth/permissions");
    const { getCurrentMembership } = await import("@/lib/auth/tenant");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const membership =
      await getCurrentMembership();

    if (!membership) {
      return NextResponse.json(
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.INTEGRATIONS_VIEW,
      )
    ) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const result = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.businessId,
            membership.businessId,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
        ),
      )
      .limit(1);

    const integration = result[0];
    const metadata = parseWebsiteChatMetadata(
      integration?.metadata,
    );

    const businessResult = await db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, membership.businessId))
      .limit(1);

    // Same real readiness check the public POST handler enforces at
    // message-send time — surfaced here proactively so the setup page can
    // show an honest "not ready" state instead of letting the business
    // believe the widget will work once installed.
    const receptionistResult = await db
      .select({ id: aiEmployees.id })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, membership.businessId),
          eq(aiEmployees.type, "receptionist"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      business: businessResult[0] || null,
      aiEmployeeReady: receptionistResult.length > 0,
      integration: integration
        ? {
            id: integration.id,
            publicKey: integration.publicKey,
            status: integration.status,
            domain: metadata.domain || null,
            welcomeMessage: metadata.welcomeMessage || null,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Load Website Chat integration error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Website Chat integration.",
      },
      { status: 500 },
    );
  }
}

export async function PUT() {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const {
      hasPermission,
      PERMISSIONS,
    } = await import("@/lib/auth/permissions");
    const { getCurrentMembership } = await import("@/lib/auth/tenant");
    const {
      unauthorizedResponse,
      forbiddenResponse,
    } = await import("@/lib/auth/security");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return unauthorizedResponse();
    }

    const membership =
      await getCurrentMembership();

    if (!membership) {
      return forbiddenResponse();
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.INTEGRATIONS_MANAGE,
      )
    ) {
      return forbiddenResponse();
    }

    const existingResult = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.businessId,
            membership.businessId,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
        ),
      )
      .limit(1);

    const existing = existingResult[0];

    if (
      existing?.status === "active" &&
      existing.publicKey
    ) {
      const existingMetadata = parseWebsiteChatMetadata(existing.metadata);
      return NextResponse.json({
        success: true,
        activated: false,
        integration: {
          id: existing.id,
          publicKey: existing.publicKey,
          status: existing.status,
          domain: existingMetadata.domain || null,
          welcomeMessage: existingMetadata.welcomeMessage || null,
        },
      });
    }

    const now = new Date();
    const generatedPublicKey =
      existing?.publicKey ||
      `kuba_pk_${randomBytes(32).toString("base64url")}`;
    const integrationId =
      existing?.id ||
      `website_chat:${membership.businessId}`;

    if (existing) {
      await db
        .update(integrations)
        .set({
          publicKey:
            existing.publicKey ||
            sql<string>`coalesce(${integrations.publicKey}, ${generatedPublicKey})`,
          status: "active",
          updatedAt: now,
        })
        .where(
          and(
            eq(
              integrations.id,
              integrationId,
            ),
            eq(
              integrations.businessId,
              membership.businessId,
            ),
          ),
        );
    } else {
      await db
        .insert(integrations)
        .values({
          id: integrationId,
          businessId:
            membership.businessId,
          provider: "website_chat",
          status: "active",
          publicKey: generatedPublicKey,
          displayName: "Website Chat",
          metadata: JSON.stringify({
            source: "dashboard_activation",
          }),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: integrations.id,
        });
    }

    const activatedResult = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.id,
            integrationId,
          ),
          eq(
            integrations.businessId,
            membership.businessId,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
        ),
      )
      .limit(1);

    const activatedIntegration =
      activatedResult[0];

    if (!activatedIntegration?.publicKey) {
      throw new Error(
        "Website Chat activation did not persist.",
      );
    }

    const activatedMetadata = parseWebsiteChatMetadata(activatedIntegration.metadata);
    const activatedIntegrationView = {
      id: activatedIntegration.id,
      publicKey: activatedIntegration.publicKey,
      status: activatedIntegration.status,
      domain: activatedMetadata.domain || null,
      welcomeMessage: activatedMetadata.welcomeMessage || null,
    };

    const created =
      !existing &&
      activatedIntegration.publicKey ===
        generatedPublicKey;

    if (!existing && !created) {
      return NextResponse.json({
        success: true,
        activated: false,
        integration: activatedIntegrationView,
      });
    }

    await createAuditLog({
      businessId: membership.businessId,
      userId: session.user.id,
      action:
        "integration.website_chat.activated",
      resource: "integration",
      resourceId: integrationId,
      description:
        "Activated the Website Chat integration.",
      metadata: {
        provider: "website_chat",
        created,
        previousStatus:
          existing?.status ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      activated: true,
      integration: activatedIntegrationView,
    });
  } catch (error) {
    console.error(
      "Activate Website Chat integration error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to activate Website Chat integration.",
      },
      { status: 500 },
    );
  }
}

// Saves the allowed website domain and/or welcome message. Config can be
// saved before first activation (a business setting up in advance), in
// which case this creates the integration row itself in "inactive" status
// with no publicKey yet — PUT is still what actually activates it.
export async function PATCH(request: Request) {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const {
      hasPermission,
      PERMISSIONS,
    } = await import("@/lib/auth/permissions");
    const { getCurrentMembership } = await import("@/lib/auth/tenant");
    const {
      unauthorizedResponse,
      forbiddenResponse,
    } = await import("@/lib/auth/security");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return unauthorizedResponse();
    }

    const membership = await getCurrentMembership();

    if (!membership) {
      return forbiddenResponse();
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.INTEGRATIONS_MANAGE,
      )
    ) {
      return forbiddenResponse();
    }

    const body = await request.json().catch(() => ({}));

    if (
      !("domain" in body) &&
      !("welcomeMessage" in body)
    ) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 },
      );
    }

    let normalizedDomain: string | null | undefined;
    if ("domain" in body) {
      const rawDomain = String(body.domain || "").trim();
      if (!rawDomain) {
        normalizedDomain = null;
      } else {
        normalizedDomain = normalizeDomain(rawDomain);
        if (!normalizedDomain) {
          return NextResponse.json(
            { error: "Enter a valid website domain, e.g. example.com." },
            { status: 400 },
          );
        }
      }
    }

    let nextWelcomeMessage: string | null | undefined;
    if ("welcomeMessage" in body) {
      const rawWelcome = String(body.welcomeMessage || "").trim();
      if (rawWelcome.length > 300) {
        return NextResponse.json(
          { error: "Welcome message must be 300 characters or fewer." },
          { status: 400 },
        );
      }
      nextWelcomeMessage = rawWelcome || null;
    }

    const existingResult = await db
      .select({
        id: integrations.id,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.businessId, membership.businessId),
          eq(integrations.provider, "website_chat"),
        ),
      )
      .limit(1);

    const existing = existingResult[0];
    const integrationId = existing?.id || `website_chat:${membership.businessId}`;
    const currentMetadata = parseWebsiteChatMetadata(existing?.metadata);

    const nextMetadata: WebsiteChatMetadata = { ...currentMetadata };
    if (normalizedDomain !== undefined) {
      if (normalizedDomain) nextMetadata.domain = normalizedDomain;
      else delete nextMetadata.domain;
    }
    if (nextWelcomeMessage !== undefined) {
      if (nextWelcomeMessage) nextMetadata.welcomeMessage = nextWelcomeMessage;
      else delete nextMetadata.welcomeMessage;
    }

    const now = new Date();

    if (existing) {
      await db
        .update(integrations)
        .set({
          metadata: JSON.stringify(nextMetadata),
          updatedAt: now,
        })
        .where(
          and(
            eq(integrations.id, existing.id),
            eq(integrations.businessId, membership.businessId),
          ),
        );
    } else {
      await db
        .insert(integrations)
        .values({
          id: integrationId,
          businessId: membership.businessId,
          provider: "website_chat",
          status: "inactive",
          displayName: "Website Chat",
          metadata: JSON.stringify(nextMetadata),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({ target: integrations.id });
    }

    const savedResult = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
        metadata: integrations.metadata,
      })
      .from(integrations)
      .where(
        and(
          eq(integrations.businessId, membership.businessId),
          eq(integrations.provider, "website_chat"),
        ),
      )
      .limit(1);

    const saved = savedResult[0];
    const savedMetadata = parseWebsiteChatMetadata(saved?.metadata);

    await createAuditLog({
      businessId: membership.businessId,
      userId: session.user.id,
      action: "integration.website_chat.configured",
      resource: "integration",
      resourceId: integrationId,
      description: "Updated Website Chat configuration.",
      metadata: {
        domainConfigured: Boolean(savedMetadata.domain),
      },
    });

    return NextResponse.json({
      success: true,
      integration: saved
        ? {
            id: saved.id,
            publicKey: saved.publicKey,
            status: saved.status,
            domain: savedMetadata.domain || null,
            welcomeMessage: savedMetadata.welcomeMessage || null,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Update Website Chat configuration error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to update Website Chat configuration.",
      },
      { status: 500 },
    );
  }
}

// The widget script (public/kuba/chat.js) runs on the VISITOR's own website
// — a different origin than this API — so its POST is a real cross-origin
// browser request. A JSON Content-Type triggers a CORS preflight (OPTIONS),
// and without a matching Access-Control-Allow-Origin response header the
// browser would refuse to even deliver the actual POST response to the
// page's JavaScript, regardless of how correct the server-side domain
// allowlist below is. Reflecting the specific request Origin (rather than a
// blanket "*") is safe here since this endpoint takes no cookies/session —
// tenant identification is exclusively the publicKey — so it carries no
// credential a hostile page could ride along with.
function withCors(response: NextResponse, origin: string | null): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", origin || "*");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function OPTIONS(request: Request) {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Vary", "Origin");
  return response;
}

export async function POST(request: Request) {
  const response = await handleWebsiteChatPost(request);
  return withCors(response, request.headers.get("origin"));
}

async function handleWebsiteChatPost(request: Request): Promise<NextResponse> {
  let responseStage =
    "parse_request";

  try {
    const body = await request.json();

    const publicKey = String(
      body.publicKey || "",
    ).trim();

    const message = String(
      body.message || "",
    ).trim();

    const requestedConversationId =
      typeof body.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    if (!publicKey || !message) {
      return NextResponse.json(
        {
          error:
            "Public key and message are required.",
        },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        {
          error: "Message is too long.",
        },
        { status: 400 },
      );
    }

    /**
     * Resolve the tenant exclusively through
     * the public website integration key.
     */
    responseStage =
      "resolve_integration";
    const integrationResult = await db
      .select({
        integration: integrations,
        business: businesses,
      })
      .from(integrations)
      .innerJoin(
        businesses,
        eq(
          integrations.businessId,
          businesses.id,
        ),
      )
      .where(
        and(
          eq(
            integrations.publicKey,
            publicKey,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
          eq(
            integrations.status,
            "active",
          ),
        ),
      )
      .limit(1);

    const record = integrationResult[0];

    if (!record) {
      return NextResponse.json(
        {
          error:
            "Website integration not found.",
        },
        { status: 404 },
      );
    }

    const integration = record.integration;
    const business = record.business;

    if (business.status !== "active") {
      return NextResponse.json(
        {
          error: "Business is not active.",
        },
        { status: 403 },
      );
    }

    /**
     * Enforce the configured allowed domain server-side. The widget script
     * only ever runs in a visitor's browser, so a client-side check alone
     * would be trivial to bypass — this is the actual security boundary.
     * Only exact-hostname matches (after stripping protocol/www/port/path)
     * are accepted, never substring/suffix/wildcard matching, so a domain
     * like "example.com" cannot be satisfied by
     * "example.com.evil.example" or "notexample.com".
     *
     * An integration with no domain configured yet is not restricted here
     * (fail-open) so already-activated integrations from before this field
     * existed keep working; once a business sets a domain, this becomes a
     * real, enforced allowlist.
     */
    responseStage = "verify_domain";
    const configuredMetadata = parseWebsiteChatMetadata(integration.metadata);
    const allowedDomain = configuredMetadata.domain;

    // A signed-in staff member testing their OWN business's widget from the
    // dashboard (e.g. a "Send a test message" control) is not a public
    // website visitor and has no Origin matching the configured domain to
    // send. Exempt the domain check only when a real session resolves the
    // CURRENTLY SELECTED business to this exact integration's business —
    // this cannot be used to bypass another tenant's domain restriction,
    // since a Realtegic staff session's own selected business will never
    // match Kora's business id, or vice versa.
    let isAuthenticatedOwnerTest = false;
    try {
      const { headers: getHeaders } = await import("next/headers");
      const { auth } = await import("@/lib/auth");
      const testSession = await auth.api.getSession({
        headers: await getHeaders(),
      });

      if (testSession?.user) {
        const { getCurrentMembership } = await import("@/lib/auth/tenant");
        const testMembership = await getCurrentMembership();
        isAuthenticatedOwnerTest = testMembership?.businessId === business.id;
      }
    } catch {
      isAuthenticatedOwnerTest = false;
    }

    if (allowedDomain && !isAuthenticatedOwnerTest) {
      const originHeader = request.headers.get("origin") || request.headers.get("referer") || "";
      const requestDomain = originHeader ? normalizeDomain(originHeader) : null;

      if (!requestDomain || requestDomain !== allowedDomain) {
        return NextResponse.json(
          {
            error: "This website is not authorized to use this integration.",
          },
          { status: 403 },
        );
      }
    }

    /**
     * Load business-specific AI configuration.
     */
    responseStage =
      "load_business_settings";
    const settingsResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          business.id,
        ),
      )
      .limit(1);

    const settings = settingsResult[0];

    /**
     * Receptionist is the fallback AI employee.
     */
    responseStage =
      "load_receptionist";
    const receptionistResult = await db
      .select({
        id: aiEmployees.id,
        name: aiEmployees.name,
        type: aiEmployees.type,
        status: aiEmployees.status,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(
            aiEmployees.businessId,
            business.id,
          ),
          eq(
            aiEmployees.type,
            "receptionist",
          ),
          eq(
            aiEmployees.status,
            "active",
          ),
        ),
      )
      .limit(1);

    const receptionist =
      receptionistResult[0];

    if (!receptionist) {
      return NextResponse.json(
        {
          error:
            "Kuba Receptionist is not active.",
        },
        { status: 404 },
      );
    }

    /**
     * Reuse an existing conversation when
     * the website widget supplies its ID.
     */
    let conversationId =
      requestedConversationId;

    if (conversationId) {
      const existingConversation =
        await db
          .select({
            id:
              conversations.id,
          })
          .from(conversations)
          .where(
            and(
              eq(
                conversations.id,
                conversationId,
              ),
              eq(
                conversations.businessId,
                business.id,
              ),
              eq(
                conversations.integrationId,
                integration.id,
              ),
            ),
          )
          .limit(1);

      if (!existingConversation[0]) {
        conversationId = "";
      }
    }

    const now = new Date();

    if (!conversationId) {
      conversationId =
        crypto.randomUUID();

      responseStage =
        "create_conversation";
      // Keep this insert compatible with the validated live baseline.
      await db.run(sql`
        INSERT INTO conversations (
          id,
          business_id,
          integration_id,
          external_conversation_id,
          customer_name,
          customer_phone,
          customer_email,
          assigned_employee_id,
          status,
          created_at,
          updated_at
        ) VALUES (
          ${conversationId},
          ${business.id},
          ${integration.id},
          ${conversationId},
          ${"Website Visitor"},
          ${null},
          ${null},
          ${receptionist.id},
          ${"open"},
          ${now.getTime()},
          ${now.getTime()}
        )
      `);
    }

    /**
     * Save the incoming visitor message first.
     */
    responseStage =
      "save_inbound_message";
    const inboundMessageId = crypto.randomUUID();
    await db
      .insert(messages)
      .values({
        id:
          inboundMessageId,

        businessId:
          business.id,

        conversationId,

        integrationId:
          integration.id,

        externalMessageId:
          null,

        direction:
          "inbound",

        senderType:
          "customer",

        senderId:
          null,

        content:
          message,

        messageType:
          "text",

        createdAt:
          now,
      });

    /**
     * Read the existing routing state.
     *
     * This allows an existing conversation to remain
     * with its current team unless the router changes it.
     */
    let enhancedRoutingAvailable =
      true;
    let existingRouting:
      | {
          department:
            string | null;
          teamId:
            string | null;
          aiEmployeeId:
            string | null;
          assignedUserId:
            string | null;
        }
      | undefined;

    responseStage =
      "load_routing";
    try {
      const existingRoutingResult =
        await db
          .select({
            department:
              conversationRouting.department,
            teamId:
              conversationRouting.teamId,
            aiEmployeeId:
              conversationRouting.aiEmployeeId,
            assignedUserId:
              conversationRouting.assignedUserId,
          })
          .from(conversationRouting)
          .where(
            eq(
              conversationRouting.conversationId,
              conversationId,
            ),
          )
          .limit(1);

      existingRouting =
        existingRoutingResult[0];
    } catch (routingLoadError) {
      if (
        classifyWebsiteChatError(
          routingLoadError,
        ) !== "missing_table"
      ) {
        throw routingLoadError;
      }

      enhancedRoutingAvailable =
        false;
      console.warn(
        "Website Chat enhanced routing tables are unavailable.",
      );
    }

    /**
     * Run the central Kuba routing engine.
     */
    const routingContext = {
      businessId:
        business.id,
      customerId:
        null,
      conversationId,
      channel:
        "website_chat" as const,
      message,
      currentDepartment:
        typeof existingRouting?.department === "string"
          ? existingRouting.department as ConversationDepartment
          : null,
      currentTeamId:
        existingRouting?.teamId ??
        null,
      currentAiEmployeeId:
        existingRouting?.aiEmployeeId ??
        null,
      currentAssignedUserId:
        existingRouting?.assignedUserId ??
        null,
    };

    responseStage =
      "route_conversation";
    let routingDecision =
      routeConversation(
        routingContext,
      );

    if (enhancedRoutingAvailable) {
      try {
        routingDecision =
          await routeConversationToTeam(
            routingContext,
          );
      } catch (teamRoutingError) {
        const failureType =
          classifyWebsiteChatError(
            teamRoutingError,
          );

        if (
          failureType !==
            "missing_table" &&
          failureType !==
            "missing_column"
        ) {
          throw teamRoutingError;
        }

        enhancedRoutingAvailable =
          false;
        console.warn(
          "Website Chat team routing tables are unavailable.",
        );
      }
    }

    /**
     * Persist routing state.
     */
    if (enhancedRoutingAvailable) {
      if (!existingRouting) {
        responseStage =
          "create_routing";
        await db
          .insert(conversationRouting)
          .values({
            id:
              crypto.randomUUID(),
            businessId:
              business.id,
            conversationId,
            department:
              routingDecision.department,
            teamId:
              routingDecision.teamId,
            aiEmployeeId:
              routingDecision.aiEmployeeId,
            assignedUserId:
              routingDecision.assignedUserId,
            assignmentType:
              routingDecision.assignmentType,
            status:
              routingDecision.status,
            priority:
              "normal",
            confidence:
              routingDecision.confidence,
            routingReason:
              routingDecision.reason,
            createdAt:
              now,
            updatedAt:
              now,
          });
      } else {
        responseStage =
          "update_routing";
        await db
          .update(conversationRouting)
          .set({
            department:
              routingDecision.department,
            teamId:
              routingDecision.teamId,
            aiEmployeeId:
              routingDecision.aiEmployeeId,
            assignedUserId:
              routingDecision.assignedUserId,
            assignmentType:
              routingDecision.assignmentType,
            status:
              routingDecision.status,
            confidence:
              routingDecision.confidence,
            routingReason:
              routingDecision.reason,
            updatedAt:
              new Date(),
          })
          .where(
            eq(
              conversationRouting.conversationId,
              conversationId,
            ),
          );
      }
    }

    /**
     * A human (or a team, pending human pickup) currently owns this
     * conversation — do not generate or send an AI reply. The customer's
     * message is already stored above for the human/team to see in the
     * Unified Inbox. The widget (public/kuba/chat.js) only ever displays
     * this synchronous response — it has no polling/websocket for a later
     * human reply — so return a truthful "handled by a person" message
     * rather than either a fabricated AI answer or the widget's generic
     * "I couldn't respond" failure fallback.
     */
    if (routingDecision.assignmentType !== "ai") {
      return NextResponse.json({
        success: true,
        response: "Thanks for your message — a member of our team will follow up with you shortly.",
        conversationId,
        aiReplySkipped: true,
        routing: {
          department: routingDecision.department,
          assignmentType: routingDecision.assignmentType,
        },
      });
    }

    /**
     * Select the routed AI employee.
     *
     * Receptionist remains the fallback if the
     * routing engine has not found an AI employee.
     */
    let selectedEmployeeId =
      receptionist.id;

    let selectedAgent =
      getKubaAgent(
        receptionist.type,
      );

    const workforceEntitlements =
      await getBusinessEntitlements(
        business.id,
      );

    if (
      routingDecision.aiEmployeeId
    ) {
      responseStage =
        "resolve_routed_employee";
      const routedEmployeeResult =
        await db
          .select({
            id:
              aiEmployees.id,

            type:
              aiEmployees.type,

            status:
              aiEmployees.status,
          })
          .from(aiEmployees)
          .where(
            and(
              eq(
                aiEmployees.id,
                routingDecision.aiEmployeeId,
              ),

              eq(
                aiEmployees.businessId,
                business.id,
              ),

              eq(
                aiEmployees.status,
                "active",
              ),
            ),
          )
          .limit(1);

      const routedEmployee =
        routedEmployeeResult[0];

      if (
        routedEmployee &&
        isEmployeeTypeEntitled(workforceEntitlements, routedEmployee.type) &&
        isEmployeeImplementationAvailable(routedEmployee.type)
      ) {
        selectedEmployeeId =
          routedEmployee.id;

        selectedAgent =
          getKubaAgent(
            routedEmployee.type,
          );
      }
    }

    /*
     * No team-based AI employee was resolved (this business hasn't set up
     * Teams/aiEmployeeTeams, or none is assigned to this department) — the
     * conversation would otherwise always fall back to Receptionist
     * regardless of detected intent. Try a direct, type-based match instead:
     * does this business have its own active Sales/Customer Support/
     * Appointment employee for the detected department? Channel eligibility,
     * plan entitlement, and implementation availability are all enforced by
     * resolveEmployeeForDepartment, so an internal-only type (e.g. Finance,
     * Marketing) can never be selected here.
     */
    if (
      selectedEmployeeId === receptionist.id &&
      routingDecision.department
    ) {
      try {
        const directResolution = await resolveEmployeeForDepartment({
          businessId: business.id,
          department: routingDecision.department,
          channel: "website_chat",
        });

        if (directResolution.ok && directResolution.employee.id !== receptionist.id) {
          selectedEmployeeId = directResolution.employee.id;
          selectedAgent = getKubaAgent(directResolution.employee.type);

          if (enhancedRoutingAvailable) {
            await db
              .update(conversationRouting)
              .set({ aiEmployeeId: directResolution.employee.id, updatedAt: new Date() })
              .where(eq(conversationRouting.conversationId, conversationId));
          }
        }
      } catch (directRoutingError) {
        console.error("Website Chat direct-type routing error:", directRoutingError);
      }
    }

    /**
     * Retrieve relevant uploaded business knowledge.
     *
     * This supplements the structured business profile with
     * information from uploaded documents and knowledge sources.
     */
    let knowledgeContext = "";

    try {
      responseStage =
        "search_knowledge";
      const knowledgeResults =
        await searchKnowledge(
          business.id,
          message,
          5,
        );

      if (knowledgeResults.length > 0) {
        knowledgeContext = knowledgeResults
          .map((item, index) => {
            return `
KNOWLEDGE SOURCE ${index + 1}

${item.content}
`;
          })
          .join("\n");
      }
    } catch (knowledgeError) {
      console.error(
        "Website Chat knowledge search error:",
        knowledgeError,
      );
    }

    /**
     * Recent conversation history, so the customer never has to repeat
     * themselves — this matters most right after an AI-to-AI handoff, where
     * a different employee (with no memory of prior turns) picks up the
     * SAME conversation. Excludes the message just saved above (it's already
     * shown as CUSTOMER MESSAGE below).
     */
    responseStage = "load_conversation_history";
    let conversationHistory = "No earlier messages in this conversation.";
    try {
      const historyRows = await db
        .select({
          direction: messages.direction,
          senderType: messages.senderType,
          content: messages.content,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(messages.conversationId, conversationId),
            eq(messages.businessId, business.id),
          ),
        )
        .orderBy(sql`${messages.createdAt} desc`)
        .limit(11);

      const priorMessages = historyRows
        .filter((row) => row.content)
        .reverse()
        .slice(0, -1); // drop the just-saved current message, appended below

      if (priorMessages.length > 0) {
        conversationHistory = priorMessages
          .map((row) => `${row.direction === "inbound" ? "Customer" : "Kuba"}: ${row.content}`)
          .join("\n");
      }
    } catch (historyError) {
      console.error("Website Chat history load error:", historyError);
    }

    /**
     * Build business context.
     */
    const businessContext = `
You are Kuba AI working for this specific business.

BUSINESS

Business name:
${business.name}

Industry:
${business.industry || ""}

Country:
${business.country || ""}

Business size:
${business.businessSize || ""}

Business description:
${settings?.businessDescription || ""}

Products and services:
${settings?.productsAndServices || ""}

Target customers:
${settings?.targetCustomers || ""}

Frequently asked questions:
${settings?.frequentlyAskedQuestions || ""}

Additional AI instructions:
${settings?.aiInstructions || ""}

Tone:
${settings?.tone || "professional"}

UPLOADED BUSINESS KNOWLEDGE

${knowledgeContext || "No relevant uploaded knowledge was found."}

ROUTING

Department:
${routingDecision.department}

Team:
${routingDecision.teamId || "No specific team"}

AI employee:
${selectedEmployeeId}

ROUTING REASON:
${routingDecision.reason}

CONVERSATION HISTORY (oldest first — this conversation may have just been
handed to you from another employee; do not ask the customer to repeat
anything already shown here):
${conversationHistory}

CUSTOMER MESSAGE:
${message}

INSTRUCTIONS

Respond as the selected Kuba AI employee for this business.
Do not claim to represent another business.
Do not invent business information.
If the business information does not contain the answer,
say so clearly and ask for the information needed.
Answer naturally, helpfully and professionally.
`;

    /**
     * Generate the AI response.
     */
    responseStage =
      "generate_response";
    const response =
      await withAIUsageLogging(
        {
          feature: "website_chat",
          businessId: business.id,
          employeeId: selectedEmployeeId,
          model: DEFAULT_CHAT_MODEL_ID,
        },
        () => selectedAgent.generate(
        businessContext,
        {
          requestContext: new RequestContext([
            ["businessId", business.id],
            ["employeeId", selectedEmployeeId],
            ["conversationId", conversationId],
            ["channel", "website_chat"],
          ]),
        },
        ),
      );

    const responseText =
      String(
        response.text || "",
      ).trim();

    if (!responseText) {
      throw new Error(
        "Kuba AI employee returned an empty response.",
      );
    }

    /**
     * Save Kuba's response.
     */
    responseStage =
      "save_outbound_message";
    await db
      .insert(messages)
      .values({
        id:
          crypto.randomUUID(),

        businessId:
          business.id,

        conversationId,

        integrationId:
          integration.id,

        externalMessageId:
          null,

        direction:
          "outbound",

        senderType:
          "ai_employee",

        senderId:
          selectedEmployeeId,

        content:
          responseText,

        messageType:
          "text",

        createdAt:
          new Date(),
      });

    try {
      await runAutomationTrigger({
        businessId: business.id,
        trigger: "customer.message_received",
        data: {
          conversationId,
          customerName: "Website Visitor",
          message,
          channel: "website",
        },
      });
    } catch (automationError) {
      console.error("Website message automation error:", automationError);
    }

    /**
     * Keep the conversation assigned to the
     * routed AI employee.
     */
    responseStage =
      "update_conversation";
    await db
      .update(conversations)
      .set({
        customerName:
          "Website Visitor",

        assignedEmployeeId:
          selectedEmployeeId,

        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            conversations.id,
            conversationId,
          ),

          eq(
            conversations.businessId,
            business.id,
          ),
        ),
      );

    return NextResponse.json({
      success:
        true,

      response:
        responseText,

      conversationId,

      routing: {
        department:
          routingDecision.department,

        teamId:
          routingDecision.teamId,

        aiEmployeeId:
          selectedEmployeeId,

        assignmentType:
          routingDecision.assignmentType,

        confidence:
          routingDecision.confidence,
      },
    });
  } catch (error) {
    console.error(
      "Website chat error:",
      error,
    );

    // AI-provider failures (missing/invalid key, rate limit, quota, timeout)
    // are checked first since classifyWebsiteChatError's categories are all
    // database-error patterns and would otherwise misreport a provider
    // failure as the generic "database_or_provider_error" bucket. A real DB
    // error still falls through unchanged — this never returns "unknown"
    // instead of a genuine database failureType classifyWebsiteChatError
    // would have found.
    const aiFailureType = classifyAIProviderError(error);
    const failureType =
      aiFailureType !== "unknown"
        ? aiFailureType
        : classifyWebsiteChatError(error);

    return NextResponse.json(
      {
        error:
          "Unable to respond.",
        code:
          "WEBSITE_CHAT_RESPONSE_FAILED",
        stage:
          responseStage,
        failureType,
        driverCode:
          getWebsiteChatDriverCode(
            error,
          ),
      },
      { status: 500 },
    );
  }
}
