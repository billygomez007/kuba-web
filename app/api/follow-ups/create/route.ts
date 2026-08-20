import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  followUps,
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
    leadId,
    assignedEmployeeId,
    title,
    description,
    dueAt,
  } = await request.json();


  if(
    !businessId ||
    !leadId ||
    !title ||
    !dueAt
  ){
    return NextResponse.json(
      {
        error:"Missing required fields",
      },
      {
        status:400,
      },
    );
  }


  await db.insert(followUps).values({

    id:
      crypto.randomUUID(),

    businessId,

    leadId,

    assignedEmployeeId:
      assignedEmployeeId || null,

    title,

    description:
      description || null,

    dueAt:
      new Date(dueAt),

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
