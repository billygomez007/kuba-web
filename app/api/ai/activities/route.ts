import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiEmployeeActivities,
} from "@/db/schema";


export async function POST(
  request: Request,
) {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if(!session?.user){

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
    type,
    title,
    description,
  } = await request.json();


  if(
    !businessId ||
    !employeeId ||
    !type ||
    !title
  ){

    return NextResponse.json(
      {
        error:"Missing activity details",
      },
      {
        status:400,
      },
    );

  }


  await db.insert(aiEmployeeActivities).values({

    id:
      crypto.randomUUID(),

    businessId,

    employeeId,

    type,

    title,

    description:
      description || null,

    status:
      "completed",

    createdAt:
      new Date(),

  });


  return NextResponse.json({
    success:true,
  });

}



export async function GET(
  request: Request,
) {

  const { searchParams } =
    new URL(request.url);


  const employeeId =
    searchParams.get("employeeId");


  const activities =
    await db
      .select()
      .from(aiEmployeeActivities);


  return NextResponse.json({
    activities:
      employeeId
      ? activities.filter(
          (a)=>
            a.employeeId === employeeId
        )
      : activities,
  });

}
