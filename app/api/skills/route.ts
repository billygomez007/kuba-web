import { NextResponse } from "next/server";

import { db } from "@/db";
import { skills } from "@/db/schema";
import { authorizationErrorResponse, requireAuth } from "@/lib/auth/authorization";


export async function GET() {
  try {
    await requireAuth();

    const result =
      await db
        .select({
          id: skills.id,
          name: skills.name,
          description: skills.description,
          category: skills.category,
          publisher: skills.publisher,
          rating: skills.rating,
          installCount: skills.installCount,
        })
        .from(skills);


    return NextResponse.json({
      skills: result,
    });


  } catch (error) {

    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;

    console.error(
      "Skills marketplace error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load skills.",
      },
      {
        status: 500,
      },
    );
  }
}
