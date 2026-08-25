import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";


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


  const business = await getCurrentMembership();


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
