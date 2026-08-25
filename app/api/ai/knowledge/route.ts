import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import {
  aiBusinessSettings,
} from "@/db/schema";


export async function GET() {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if (!session?.user) {
    return NextResponse.json(
      { error:"Unauthorized" },
      { status:401 },
    );
  }


  const business = await getCurrentMembership();


  if (!business) {
    return NextResponse.json(
      { error:"Business not found" },
      { status:404 },
    );
  }

  if (!hasPermission(business.role, business.permissions, PERMISSIONS.KNOWLEDGE_VIEW)) return NextResponse.json({ error: "Knowledge access denied." }, { status: 403 });


  const knowledge =
    await db
      .select()
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          business.businessId,
        ),
      )
      .limit(1);


  return NextResponse.json({
    knowledge: knowledge[0] || null,
  });

}


export async function POST(
  request: Request,
) {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if (!session?.user) {
    return NextResponse.json(
      {
        error:"Unauthorized",
      },
      {
        status:401,
      },
    );
  }


  const body =
    await request.json();


  const cleanText = (value: unknown) => String(value || "").trim().slice(0, 20000) || null;
  const businessDescription = cleanText(body.businessDescription);
  const productsAndServices = cleanText(body.productsAndServices);
  const targetCustomers = cleanText(body.targetCustomers);
  const frequentlyAskedQuestions = cleanText(body.frequentlyAskedQuestions);
  const aiInstructions = cleanText(body.aiInstructions);
  const requestedTone = String(body.tone || "professional").trim();
  const tone = ["professional", "friendly", "formal", "conversational"].includes(requestedTone) ? requestedTone : "professional";


  const business = await getCurrentMembership();


  if (!business) {
    return NextResponse.json(
      {
        error:"Business not found",
      },
      {
        status:404,
      },
    );
  }

  if (!hasPermission(business.role, business.permissions, PERMISSIONS.KNOWLEDGE_MANAGE)) return NextResponse.json({ error: "Knowledge management access denied." }, { status: 403 });


  await db
    .insert(aiBusinessSettings)
    .values({
      id: crypto.randomUUID(),
      businessId:
        business.businessId,
      businessDescription,
      productsAndServices,
      frequentlyAskedQuestions,
      targetCustomers,
      aiInstructions,
      tone,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target:
        aiBusinessSettings.businessId,
      set:{
        businessDescription,
        productsAndServices,
        frequentlyAskedQuestions,
        targetCustomers,
        aiInstructions,
        tone,
        updatedAt: new Date(),
      },
    });

  await createAuditLog({ businessId: business.businessId, userId: session.user.id, action: "business_brain.knowledge.updated", resource: "ai_business_settings", description: "Structured business knowledge updated." });


  return NextResponse.json({
    success:true,
  });

}
