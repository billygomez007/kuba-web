import { NextResponse } from "next/server";
import crypto from "crypto";
import { and, eq, lte } from "drizzle-orm";

import { db } from "@/db";
import {
  followUps,
  leads,
} from "@/db/schema";

import {
  runAutomationTrigger,
} from "@/lib/automations/engine";


function isAuthorized(request: Request) {
  const configuredSecret =
    process.env.AUTOMATION_PROCESS_SECRET;

  if (!configuredSecret) {
    console.error(
      "AUTOMATION_PROCESS_SECRET is not configured.",
    );

    return false;
  }

  const providedSecret =
    request.headers.get(
      "x-automation-secret",
    );

  if (!providedSecret) return false;
  const expected = Buffer.from(configuredSecret);
  const received = Buffer.from(providedSecret);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}


export async function POST(
  request: Request,
) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const now = new Date();

    const dueFollowUps =
      await db
        .select({
          followUp: followUps,
          lead: leads,
        })
        .from(followUps)
        .innerJoin(
          leads,
          eq(
            followUps.leadId,
            leads.id,
          ),
        )
        .where(
          and(
            eq(
              followUps.status,
              "pending",
            ),
            lte(
              followUps.dueAt,
              now,
            ),
          ),
        );

    const processed: Array<
      Record<string, unknown>
    > = [];

    for (const item of dueFollowUps) {
      try {
        await runAutomationTrigger({
          businessId:
            item.followUp.businessId,

          trigger:
            "follow_up.due",

          data: {
            followUpId:
              item.followUp.id,

            leadId:
              item.lead.id,

            leadName:
              item.lead.name,

            leadEmail:
              item.lead.email,

            leadPhone:
              item.lead.phone,

            title:
              item.followUp.title,

            description:
              item.followUp.description,

            dueAt:
              item.followUp.dueAt,
          },
        });

        await db
          .update(followUps)
          .set({
            status:
              "assigned_to_ai",

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              followUps.id,
              item.followUp.id,
            ),
          );

        processed.push({
          id:
            item.followUp.id,

          status:
            "processed",
        });

      } catch (error) {
        console.error(
          "Follow-up automation error:",
          error,
        );

        processed.push({
          id:
            item.followUp.id,

          status:
            "failed",

          error: "Automation trigger failed.",
        });
      }
    }

    return NextResponse.json({
      success: true,

      processed,

      count:
        processed.length,

      processedAt:
        now.toISOString(),
    });

  } catch (error) {
    console.error(
      "Automation processor error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to process automations.",
      },
      {
        status: 500,
      },
    );
  }
}
