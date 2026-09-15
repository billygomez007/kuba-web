import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { getResend } from "@/lib/email/resend";

import type { ChannelAdapter } from "./types";

/**
 * Canonical tenant-scoped Email adapter for human/automation messages.
 *
 * The provider sender is deliberately the configured, verified platform
 * identity. Tenant selection always comes from the trusted businessId and an
 * active Email integration row; no recipient or display name is used to pick
 * a tenant.
 */
export const emailAdapter: ChannelAdapter = {
  async send(payload) {
    const integration = await db
      .select({ id: integrations.id })
      .from(integrations)
      .where(
        and(
          eq(integrations.businessId, payload.businessId),
          eq(integrations.provider, "email"),
          eq(integrations.status, "active"),
        ),
      )
      .limit(1);

    if (!integration[0]) {
      return { success: false, error: "email_not_connected" };
    }

    const from = process.env.EMAIL_FROM;
    if (!process.env.RESEND_API_KEY || !from) {
      return { success: false, error: "email_not_configured" };
    }

    try {
      const response = await getResend().emails.send({
        from,
        to: payload.recipient,
        subject: "Message from SuperKuba",
        text: payload.message,
      });

      if (response.error) {
        return { success: false, error: response.error.message || response.error.name };
      }

      return { success: true, externalMessageId: response.data?.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Email could not be sent.",
      };
    }
  },
};
