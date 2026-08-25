import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { businesses, businessUsers } from "@/db/schema";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const businessId =
    typeof body.businessId === "string" ? body.businessId.trim() : "";

  if (!businessId) {
    return NextResponse.json(
      { error: "businessId is required." },
      { status: 400 },
    );
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
      name: businesses.name,
    })
    .from(businessUsers)
    .innerJoin(businesses, eq(businessUsers.businessId, businesses.id))
    .where(
      eq(businessUsers.userId, session.user.id),
    )
    .then((rows) => rows.find((row) => row.businessId === businessId));

  if (!membership) {
    return NextResponse.json({ error: "Business access denied." }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set("superkuba_business_id", businessId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  return NextResponse.json({ success: true, business: membership });
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  (await cookies()).delete("superkuba_business_id");
  return NextResponse.json({ success: true });
}