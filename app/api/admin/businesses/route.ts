import { NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { authorizationErrorResponse, requireSuperAdmin } from "@/lib/auth/authorization";


export async function GET() {

  try {
    await requireSuperAdmin();

    const allBusinesses =
      await db
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          plan: businesses.plan,
          status: businesses.status,
          createdAt: businesses.createdAt,
        })
        .from(businesses);


    const active =
      allBusinesses.filter(
        (item) =>
          item.status === "active",
      ).length;


    const trial =
      allBusinesses.filter(
        (item) =>
          item.plan === "trial",
      ).length;


    const suspended =
      allBusinesses.filter(
        (item) =>
          item.status === "suspended",
      ).length;


    return NextResponse.json({

      stats: {
        total: allBusinesses.length,
        active,
        trial,
        suspended,
      },

      businesses: allBusinesses,

    });


  } catch(error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;

    console.error(
      "Admin businesses error:",
      error,
    );


    return NextResponse.json(
      {
        error: "Unable to load businesses",
      },
      {
        status:500,
      },
    );

  }

}
