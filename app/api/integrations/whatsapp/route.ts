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

  /*
   * A WhatsApp phone_number_id identifies one real Meta business phone
   * number. Two different Kuba businesses connecting the same
   * phone_number_id would make inbound webhook tenant resolution
   * ambiguous — the webhook must be able to trust that a phone_number_id
   * belongs to exactly one business. Only an "active" claim blocks a new
   * connection, consistent with lib/channels/whatsapp.ts, so a business
   * that has disconnected can release a number for reuse.
   */
  const claimedByAnotherBusiness =
    await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.provider, "whatsapp"),
          eq(integrations.externalPhoneNumberId, phoneNumberId),
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

        externalAccountId:
          businessId,

        externalPhoneNumberId:
          phoneNumberId,

        displayName:
          "WhatsApp Business",

        credentialsEncrypted:
          encrypt(accessToken),

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

      externalAccountId:
        businessId,

      externalPhoneNumberId:
        phoneNumberId,

      displayName:
        "WhatsApp Business",

      credentialsEncrypted:
        encrypt(accessToken),

      metadata:
        JSON.stringify({
          source:
            "dashboard_setup",
        }),

      createdAt:
        new Date(),

      updatedAt:
        new Date(),
    });

  return NextResponse.json({
    success: true,
    created: true,
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
