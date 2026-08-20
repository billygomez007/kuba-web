import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  customerTags,
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
    customerId,
    tag,
  } = await request.json();


  if (!customerId || !tag) {
    return NextResponse.json(
      {
        error:"Customer and tag required",
      },
      {
        status:400,
      },
    );
  }


  await db.insert(customerTags).values({

    id:
      crypto.randomUUID(),

    customerId,

    tag,

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


  const customerId =
    searchParams.get("customerId");


  if (!customerId) {
    return NextResponse.json(
      {
        error:"Customer required",
      },
      {
        status:400,
      },
    );
  }


  const tags =
    await db
      .select()
      .from(customerTags)
      .where(
        eq(
          customerTags.customerId,
          customerId,
        ),
      );


  return NextResponse.json({
    tags,
  });

}
