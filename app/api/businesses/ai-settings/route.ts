import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiBusinessSettings,
  businessUsers,
} from "@/db/schema";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 },
      );
    }

    const membership = await db
      .select({
        businessId: businessUsers.businessId,
        role: businessUsers.role,
      })
      .from(businessUsers)
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = membership[0];

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with this account.",
        },
        { status: 404 },
      );
    }

    if (
      business.role !== "owner" &&
      business.role !== "admin"
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
          business.businessId,
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
        businessId: business.businessId,
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