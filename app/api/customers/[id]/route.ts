import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const {
      user,
      membership,
      error,
    } =
      await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        {
          error:
            error || "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            error ||
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    const { id } = await params;

    const result =
      await db
        .select()
        .from(customers)
        .where(
          and(
            eq(
              customers.id,
              id,
            ),
            eq(
              customers.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const customer =
      result[0];

    if (!customer) {
      return NextResponse.json(
        {
          error:
            "Customer not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      customer,
    });
  } catch (error) {
    console.error(
      "Customer profile error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load customer.",
      },
      { status: 500 },
    );
  }
}
