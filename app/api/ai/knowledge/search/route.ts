import { NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/tenant";

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


    const results =
      await searchKnowledge(
        business.businessId,
        query,
        limit,
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
