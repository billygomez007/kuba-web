import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";


export async function GET() {

  try {

    const {
      membership,
    } = await requireBusinessMembership();


    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status:401,
        },
      );
    }


    const employees =
      await db
        .select({
          id: aiEmployees.id,
          name: aiEmployees.name,
          type: aiEmployees.type,
        })
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            membership.businessId,
          ),
        );


    return NextResponse.json({
      employees,
    });


  } catch(error) {

    console.error(
      "Skills employees error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load employees.",
      },
      {
        status:500,
      },
    );
  }
}
