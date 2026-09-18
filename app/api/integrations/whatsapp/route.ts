import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { encrypt } from "@/lib/encryption";
import { integrations } from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

import {
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth/security";

async function getAccess() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return null;
  }

  const membership =
    await getBusinessMembership(
      session.user.id,
    );

  if (!membership) {
    return null;
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    );

  if (!allowed) {
    return null;
  }

  return membership;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const membership =
    await getBusinessMembership(
      session.user.id,
    );

  if (!membership) {
    return forbiddenResponse();
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    );

  if (!allowed) {
    return forbiddenResponse();
  }

  const formData = await request.formData();

  const transportProvider =
    String(
      formData.get("transportProvider") || "meta",
    ).trim() === "wati"
      ? "wati"
      : "meta";

  let externalAccountId = "";
  let externalPhoneNumberId = "";
  let credential = "";
  let metadata: Record<string, string> = {
    source: "dashboard_setup",
    transportProvider,
  };

  if (transportProvider === "wati") {
    const apiBaseUrl =
      String(formData.get("apiBaseUrl") || "").trim();
    const channelNumber =
      String(formData.get("channelNumber") || "").trim();
    const apiToken =
      String(formData.get("apiToken") || "").trim();

    if (!apiBaseUrl || !apiToken || !channelNumber) {
      return NextResponse.json(
        {
          error:
            "WATI API Base URL, API Token, and Channel Number are required.",
        },
        { status: 400 },
      );
    }

    try {
      const url = new URL(apiBaseUrl);

      if (url.protocol !== "https:") {
        throw new Error("invalid_protocol");
      }

      externalAccountId = url.pathname
        .split("/")
        .filter(Boolean)
        .at(-1) || url.hostname;

      // For WATI, this field is the authoritative external channel
      // identity used to resolve inbound webhooks to the correct tenant.
      // Never fall back to the WATI account id.
      externalPhoneNumberId = channelNumber;

      credential = apiToken;

      metadata = {
        ...metadata,
        apiBaseUrl:
          url.toString().replace(/\/+$/, ""),
        channelNumber,
      };
    } catch {
      return NextResponse.json(
        {
          error:
            "WATI API Base URL must be a valid HTTPS URL.",
        },
        { status: 400 },
      );
    }
  } else {
    const businessId =
      String(
        formData.get("businessId") || "",
      ).trim();

    const phoneNumberId =
      String(
        formData.get("phoneNumberId") || "",
      ).trim();

    const accessToken =
      String(
        formData.get("accessToken") || "",
      ).trim();

    if (
      !businessId ||
      !phoneNumberId ||
      !accessToken
    ) {
      return NextResponse.json(
        {
          error:
            "Business ID, Phone Number ID, and Access Token are required.",
        },
        { status: 400 },
      );
    }

    externalAccountId = businessId;
    externalPhoneNumberId = phoneNumberId;
    credential = accessToken;
  }

  const claimedByAnotherBusiness =
    await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "whatsapp"),
          eq(
            integrations.externalPhoneNumberId,
            externalPhoneNumberId,
          ),
          eq(integrations.status, "active"),
          ne(integrations.businessId, membership.businessId),
        ),
      )
      .limit(1);

  if (claimedByAnotherBusiness.length > 0) {
    return NextResponse.json(
      {
        error:
          "This WhatsApp connection is already connected to another Kuba business.",
      },
      { status: 409 },
    );
  }

  const existing =
    await db
      .select({
        id: integrations.id,
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
            "whatsapp",
          ),
        ),
      )
      .limit(1);

  const values = {
    status: "active",
    externalAccountId,
    externalPhoneNumberId,
    displayName:
      transportProvider === "wati"
        ? "WhatsApp via WATI"
        : "WhatsApp Business",
    credentialsEncrypted:
      encrypt(credential),
    metadata:
      JSON.stringify(metadata),
    updatedAt:
      new Date(),
  };

  if (existing.length > 0) {
    await db
      .update(integrations)
      .set(values)
      .where(
        eq(
          integrations.id,
          existing[0].id,
        ),
      );

    return NextResponse.json({
      success: true,
      updated: true,
      transportProvider,
    });
  }

  await db
    .insert(integrations)
    .values({
      id:
        crypto.randomUUID(),

      businessId:
        membership.businessId,

      provider:
        "whatsapp",

      ...values,

      createdAt:
        new Date(),
    });

  return NextResponse.json({
    success: true,
    created: true,
    transportProvider,
  });
}

export async function DELETE() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return unauthorizedResponse();
  }

  const membership =
    await getBusinessMembership(
      session.user.id,
    );

  if (!membership) {
    return forbiddenResponse();
  }

  const allowed =
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.INTEGRATIONS_MANAGE,
    );

  if (!allowed) {
    return forbiddenResponse();
  }

  const existing =
    await db
      .select({
        id:
          integrations.id,
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
            "whatsapp",
          ),
        ),
      )
      .limit(1);

  if (!existing[0]) {
    return NextResponse.json({
      success: true,
      disconnected: false,
    });
  }

  await db
    .delete(integrations)
    .where(
      eq(
        integrations.id,
        existing[0].id,
      ),
    );

  return NextResponse.json({
    success: true,
    disconnected: true,
  });
}
