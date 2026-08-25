import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  and,
  desc,
  eq,
  or,
  isNull,
} from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  aiEmployees,
  knowledgeSources,
} from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";


export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: employeeId } =
      await params;

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    const employee =
      await db
        .select({
          id: aiEmployees.id,
          name: aiEmployees.name,
          type: aiEmployees.type,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.id,
              employeeId,
            ),
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
          ),
        )
        .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        {
          error:
            "AI employee not found.",
        },
        { status: 404 },
      );
    }

    const documents =
      await db
        .select()
        .from(knowledgeSources)
        .where(
          and(
            eq(
              knowledgeSources.businessId,
              business.businessId,
            ),
            or(
              eq(
                knowledgeSources.employeeId,
                employeeId,
              ),
              isNull(
                knowledgeSources.employeeId,
              ),
            ),
          ),
        )
        .orderBy(
          desc(
            knowledgeSources.createdAt,
          ),
        );

    return NextResponse.json({
      employee: employee[0],
      documents,
    });

  } catch (error) {
    console.error(
      "Employee documents error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load employee documents.",
      },
      { status: 500 },
    );
  }
}
