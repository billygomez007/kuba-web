import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
} from "@/db/schema";


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


  const {
    businessId,
    employeeId,
    channel,
    recipient,
    message,
  } = await request.json();


  if(
    !businessId ||
    !channel ||
    !recipient ||
    !message
  ){

    return NextResponse.json(
      {
        error:"Missing action details",
      },
      {
        status:400,
      },
    );

  }


  await db.insert(actionApprovals).values({

    id:
      crypto.randomUUID(),

    businessId,

    employeeId:
      employeeId || null,

    channel,

    recipient,

    message,

    status:
      "pending",

    createdAt:
      new Date(),

    updatedAt:
      new Date(),

  });


  return NextResponse.json({
    success:true,
  });

}


export async function GET() {

  const actions =
    await db
      .select()
      .from(actionApprovals);


  return NextResponse.json({
    actions,
  });

}


export async function PATCH(
  request: Request,
) {

  const {
    actionId,
    status,
  } = await request.json();


  if(!actionId || !status){

    return NextResponse.json(
      {
        error:"Missing data",
      },
      {
        status:400,
      },
    );

  }


  await db
    .update(actionApprovals)
    .set({
      status,
      updatedAt:new Date(),
    })
    .where(
      eq(
        actionApprovals.id,
        actionId,
      ),
    );


  return NextResponse.json({
    success:true,
  });

}
