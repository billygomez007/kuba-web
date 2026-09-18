import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, ne } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { encrypt } from "@/lib/encryption";
import { integrations } from "@/db/schema";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

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
    await getCurrentMembership();

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
    await getCurrentMembership();

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

  const formData =
    await request.formData();

  const transportProvider =
    String(
      formData.get("transportProvider") || "meta",
    ).trim() === "wati"
      ? "wati"
      : "meta";

  let externalAccountId = "";
  let externalPhoneNumberId = "";
  let credential = "";

  let integrationMetadata: Record<string, string> = {
    source: "dashboard_setup",
    transportProvider,
  };

  if (transportProvider === "wati") {
    const apiBaseUrl =
      String(
        formData.get("apiBaseUrl") || "",
      ).trim();

    const channelNumber =
      String(
        formData.get("channelNumber") || "",
      )
        .replace(/\D/g, "")
        .trim();

    const apiToken =
      String(
        formData.get("apiToken") || "",
      ).trim();

    if (
      !apiBaseUrl ||
      !channelNumber ||
      !apiToken
    ) {
      return NextResponse.json(
        {
          error:
            "WATI API Base URL, Channel Number, and API Token are required.",
        },
        { status: 400 },
      );
    }

    try {
      const parsedUrl =
        new URL(apiBaseUrl);

      if (parsedUrl.protocol !== "https:") {
        throw new Error("invalid_protocol");
      }

      externalAccountId =
        parsedUrl.pathname
          .split("/")
          .filter(Boolean)
          .at(-1) ||
        parsedUrl.hostname;

      externalPhoneNumberId =
        channelNumber;

      credential =
        apiToken;

      integrationMetadata = {
        ...integrationMetadata,
        apiBaseUrl:
          parsedUrl
            .toString()
            .replace(/\/+$/, ""),
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

    externalAccountId =
      businessId;

    externalPhoneNumberId =
      phoneNumberId;

    credential =
      accessToken;
  }

  /*
   * A WhatsApp external channel identity must resolve to only one
   * active Kuba business. For Meta this is phone_number_id; for WATI
   * this is the canonical digits-only channel number.
   */

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
          "This WhatsApp phone number is already connected to another Kuba business.",
      },
      { status: 409 },
    );
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

  if (existing.length > 0) {
    await db
      .update(integrations)
      .set({
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
          JSON.stringify(
            integrationMetadata,
          ),

        updatedAt:
          new Date(),
      })
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

      status:
        "active",

      externalAccountId,

      externalPhoneNumberId,

      displayName:
        transportProvider === "wati"
          ? "WhatsApp via WATI"
          : "WhatsApp Business",

      credentialsEncrypted:
        encrypt(credential),

      metadata:
        JSON.stringify(
          integrationMetadata,
        ),

      createdAt:
        new Date(),

      updatedAt:
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
    await getCurrentMembership();

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
