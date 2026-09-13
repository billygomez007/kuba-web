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

    // A field the caller never submitted (not in formData at all) means
    // "leave this alone" — distinct from a field submitted as an empty
    // string, which means the user intentionally cleared it. This matters
    // because two different forms share this one route: the full AI
    // settings page always submits every field (so "" there really is a
    // clear), while onboarding's Business training step only collects
    // businessDescription/productsAndServices/targetCustomers and has no UI
    // for aiInstructions or FAQs — it must not blank out content an earlier
    // onboarding step (or a later settings-page edit) already saved there.
    const readField = (key: string): string | undefined =>
      formData.has(key) ? String(formData.get(key) || "").trim() : undefined;

    const businessDescription = readField("businessDescription");
    const productsAndServices = readField("productsAndServices");
    const targetCustomers = readField("targetCustomers");
    const frequentlyAskedQuestions = readField("frequentlyAskedQuestions");
    const aiInstructions = readField("aiInstructions");

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
      const updateValues: Record<string, unknown> = {
        tone: safeTone,
        updatedAt: now,
      };
      if (businessDescription !== undefined) updateValues.businessDescription = businessDescription || null;
      if (productsAndServices !== undefined) updateValues.productsAndServices = productsAndServices || null;
      if (targetCustomers !== undefined) updateValues.targetCustomers = targetCustomers || null;
      if (frequentlyAskedQuestions !== undefined) updateValues.frequentlyAskedQuestions = frequentlyAskedQuestions || null;
      if (aiInstructions !== undefined) updateValues.aiInstructions = aiInstructions || null;

      await db
        .update(aiBusinessSettings)
        .set(updateValues)
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
