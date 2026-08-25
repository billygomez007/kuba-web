import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

import {
  searchKnowledge,
} from "@/lib/knowledge/search";


export async function POST(
  request: Request,
) {
  try {

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
          error:
            "Business not found",
        },
        {
          status: 404,
        },
      );
    }
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.KNOWLEDGE_VIEW)) return NextResponse.json({ error: "Knowledge access denied." }, { status: 403 });


    const body =
      await request.json();


    const query =
      String(
        body.query || "",
      ).trim();


    const requestedLimit =
      Number(
        body.limit || 8,
      );


    const limit =
      Number.isFinite(
        requestedLimit,
      )
        ? Math.min(
            Math.max(
              requestedLimit,
              1,
            ),
            20,
          )
        : 8;


    if (!query) {
      return NextResponse.json(
        {
          error:
            "A search query is required.",
        },
        {
          status: 400,
        },
      );
    }

    const employeeId = typeof body.employeeId === "string" && body.employeeId.trim() ? body.employeeId.trim() : undefined;
    if (employeeId) {
      const employee = await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, business.businessId))).limit(1);
      if (!employee[0]) return NextResponse.json({ error: "AI employee not found for the selected business." }, { status: 404 });
    }


    const results =
      await searchKnowledge(
        business.businessId,
        query,
        limit,
        employeeId,
      );


    return NextResponse.json({
      success: true,
      query,
      results,
    });


  } catch (error) {

    console.error(
      "Knowledge search error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to search business knowledge.",
      },
      {
        status: 500,
      },
    );
  }
}
