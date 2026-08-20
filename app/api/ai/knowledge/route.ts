import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiBusinessSettings,
  businessUsers,
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


  const membership =
    await db
      .select({
        businessId:
          businessUsers.businessId,
      })
      .from(businessUsers)
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);


  const business =
    membership[0];


  if (!business) {
    return NextResponse.json(
      { error:"Business not found" },
      { status:404 },
    );
  }


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


  const {
    businessDescription,
    productsAndServices,
    frequentlyAskedQuestions,
    aiInstructions,
    tone,
  } = body;


  const membership =
    await db
      .select({
        businessId:
          businessUsers.businessId,
      })
      .from(businessUsers)
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);


  const business =
    membership[0];


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


  await db
    .insert(aiBusinessSettings)
    .values({
      id: crypto.randomUUID(),
      businessId:
        business.businessId,
      businessDescription,
      productsAndServices,
      frequentlyAskedQuestions,
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
        aiInstructions,
        tone,
        updatedAt: new Date(),
      },
    });


  return NextResponse.json({
    success:true,
  });

}
