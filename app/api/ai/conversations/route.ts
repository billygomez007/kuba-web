import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, asc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  conversations,
  messages,
  aiEmployees,
} from "@/db/schema";


export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get("employeeId");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 },
      );
    }


    const businessResult = await db
      .select({
        business: businesses,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(
          businessUsers.businessId,
          businesses.id,
        ),
      )
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);


    const business = businessResult[0]?.business;


    if (!business) {
      return NextResponse.json(
        { messages: [] },
      );
    }


    let conversationId: string | null = null;

    if (employeeId) {
      const employeeResult = await db
        .select({
          id: aiEmployees.id,
          type: aiEmployees.type,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.id, employeeId),
            eq(aiEmployees.businessId, business.id),
            eq(aiEmployees.status, "active"),
          ),
        )
        .limit(1);

      const employee = employeeResult[0];

      if (!employee) {
        return NextResponse.json(
          { error: "AI employee not found." },
          { status: 404 },
        );
      }

      conversationId = `${employee.type}-${employee.id}`;
    }

    const result = await db
      .select()
      .from(messages)
      .where(
        conversationId
          ? and(
              eq(messages.businessId, business.id),
              eq(messages.conversationId, conversationId),
            )
          : eq(messages.businessId, business.id),
      )
      .orderBy(
        asc(messages.createdAt),
      );


    return NextResponse.json({
      messages: result,
    });


  } catch (error) {

    console.error(
      "Conversation loading error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load conversation.",
      },
      {
        status:500,
      },
    );
  }
}
