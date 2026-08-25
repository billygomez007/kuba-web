import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiBusinessSettings,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { createAuditLog } from "@/lib/auth/audit";

export async function POST(request: Request) {
  try {
    const { user, membership, error } = await requireBusinessMembership();
    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });

    if (
      membership.role !== "owner" &&
      membership.role !== "admin"
    ) {
      return NextResponse.json(
        {
          error:
            "Only business owners and administrators can edit AI configuration.",
        },
        { status: 403 },
      );
    }

    const formData = await request.formData();

    const businessDescription = String(
      formData.get("businessDescription") || "",
    ).trim();

    const productsAndServices = String(
      formData.get("productsAndServices") || "",
    ).trim();

    const targetCustomers = String(
      formData.get("targetCustomers") || "",
    ).trim();

    const frequentlyAskedQuestions = String(
      formData.get("frequentlyAskedQuestions") || "",
    ).trim();

    const aiInstructions = String(
      formData.get("aiInstructions") || "",
    ).trim();

    const tone = String(
      formData.get("tone") || "professional",
    ).trim();

    const allowedTones = [
      "professional",
      "friendly",
      "formal",
      "conversational",
    ];

    const safeTone = allowedTones.includes(tone)
      ? tone
      : "professional";

    const existing = await db
      .select({
        id: aiBusinessSettings.id,
      })
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          membership.businessId,
        ),
      )
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      await db
        .update(aiBusinessSettings)
        .set({
          businessDescription:
            businessDescription || null,
          productsAndServices:
            productsAndServices || null,
          targetCustomers:
            targetCustomers || null,
          frequentlyAskedQuestions:
            frequentlyAskedQuestions || null,
          aiInstructions:
            aiInstructions || null,
          tone: safeTone,
          updatedAt: now,
        })
        .where(
          eq(
            aiBusinessSettings.id,
            existing[0].id,
          ),
        );
    } else {
      await db.insert(aiBusinessSettings).values({
        id: crypto.randomUUID(),
        businessId: membership.businessId,
        businessDescription:
          businessDescription || null,
        productsAndServices:
          productsAndServices || null,
        targetCustomers:
          targetCustomers || null,
        frequentlyAskedQuestions:
          frequentlyAskedQuestions || null,
        aiInstructions:
          aiInstructions || null,
        tone: safeTone,
        createdAt: now,
        updatedAt: now,
      });
    }

    await createAuditLog({ businessId: membership.businessId, userId: user.id, action: "business_brain.instructions.updated", resource: "ai_business_settings", resourceId: existing[0]?.id || null, description: "Business knowledge and AI instructions updated." });

    return NextResponse.redirect(
      new URL("/dashboard/settings/ai", request.url),
    );
  } catch (error) {
    console.error(
      "AI configuration update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update AI configuration.",
      },
      { status: 500 },
    );
  }
}
