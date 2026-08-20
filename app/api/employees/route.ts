import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiEmployees,
  businessUsers,
} from "@/db/schema";


export async function GET() {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if (!session?.user) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
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
      {
        error: "Business not found",
      },
      {
        status:404,
      },
    );
  }


  const employees =
    await db
      .select()
      .from(aiEmployees)
      .where(
        eq(
          aiEmployees.businessId,
          business.businessId,
        ),
      );


  return NextResponse.json({
    success:true,
    employees,
  });

}
