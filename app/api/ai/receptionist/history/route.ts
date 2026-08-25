import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  messages,
  aiEmployees,
} from "@/db/schema";

import { and, eq, desc } from "drizzle-orm";


export async function GET() {
  try {

    const session =
      await auth.api.getSession({
        headers: await headers(),
      });


    if (!session?.user) {
      return NextResponse.json(
        {
          messages: [],
        },
      );
    }


    const business = await getCurrentMembership();


    if (!business) {
      return NextResponse.json({
        messages: [],
      });
    }


    const receptionist =
      await db
        .select({
          id: aiEmployees.id,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
            eq(
              aiEmployees.type,
              "receptionist",
            ),
          ),
        )
        .limit(1);


    if (!receptionist[0]) {
      return NextResponse.json({
        messages: [],
      });
    }


    const history =
      await db
        .select({
          content:
            messages.content,

          senderType:
            messages.senderType,

          createdAt:
            messages.createdAt,
        })
        .from(messages)
        .where(
          eq(
            messages.senderId,
            receptionist[0].id,
          ),
        )
        .orderBy(
          desc(messages.createdAt),
        )
        .limit(50);


    return NextResponse.json({
      messages:
        history.reverse(),
    });


  } catch(error) {

    console.error(
      "Receptionist history error",
      error,
    );

    return NextResponse.json({
      messages: [],
    });

  }
}
