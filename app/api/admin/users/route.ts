import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, businessUsers, users } from "@/db/schema";
import { authorizationErrorResponse, requireSuperAdmin } from "@/lib/auth/authorization";

export async function GET() {
  try {
    await requireSuperAdmin();

    const [allUsers, memberships] = await Promise.all([
      db.select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        platformRole: users.platformRole,
        createdAt: users.createdAt,
      }).from(users),
      db.select({
        userId: businessUsers.userId,
        role: businessUsers.role,
        businessId: businesses.id,
        businessName: businesses.name,
      }).from(businessUsers).innerJoin(businesses, eq(businessUsers.businessId, businesses.id)),
    ]);

    const membershipsByUser = new Map<string, typeof memberships>();
    for (const membership of memberships) {
      const records = membershipsByUser.get(membership.userId) ?? [];
      records.push(membership);
      membershipsByUser.set(membership.userId, records);
    }

    return NextResponse.json({
      users: allUsers.map((user) => ({ ...user, businesses: membershipsByUser.get(user.id) ?? [] })),
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Admin users error:", error);
    return NextResponse.json({ error: "Unable to load platform users." }, { status: 500 });
  }
}
