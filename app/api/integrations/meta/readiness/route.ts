import {
  NextResponse,
} from "next/server";

import {
  and,
  eq,
  inArray,
} from "drizzle-orm";

import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";
import {
  getCurrentMembership,
} from "@/lib/auth/tenant";

export async function GET() {
  const membership =
    await getCurrentMembership();

  if (!membership) {
    return NextResponse.json(
      {
        error:
          "Business not found.",
      },
      { status: 404 },
    );
  }

  const rows =
    await db
      .select({
        id:
          integrations.id,
        provider:
          integrations.provider,
        status:
          integrations.status,
        displayName:
          integrations.displayName,
        externalAccountId:
          integrations.externalAccountId,
        lastWebhookAt:
          integrations.lastWebhookAt,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.businessId,
            membership.businessId,
          ),
          inArray(
            integrations.provider,
            [
              "facebook",
              "instagram",
            ],
          ),
        ),
      );

  return NextResponse.json({
    channels:
      rows.map((row) => ({
        ...row,
        ready:
          row.status === "active" &&
          Boolean(
            row.lastWebhookAt,
          ),
      })),
  });
}
