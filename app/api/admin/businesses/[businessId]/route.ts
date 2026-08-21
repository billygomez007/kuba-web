import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses } from "@/db/schema";
import { authorizationErrorResponse, requireSuperAdmin } from "@/lib/auth/authorization";
import { createPlatformAuditLog } from "@/lib/platform/audit";

const allowedStatuses = new Set(["active", "suspended"]);

export async function PATCH(request: Request, context: { params: Promise<{ businessId: string }> }) {
  try {
    const admin = await requireSuperAdmin();
    const { businessId } = await context.params;
    const body = await request.json();
    const status = typeof body.status === "string" ? body.status : "";
    if (!allowedStatuses.has(status)) return NextResponse.json({ error: "Status must be active or suspended." }, { status: 400 });

    const existing = (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1))[0];
    if (!existing) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    await db.update(businesses).set({ status, updatedAt: new Date() }).where(eq(businesses.id, businessId));
    await createPlatformAuditLog({ actorUserId: admin.id, action: status === "suspended" ? "business.suspended" : "business.reactivated", targetType: "business", targetId: businessId, result: "success", metadata: { status } });
    return NextResponse.json({ success: true, businessId, status });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Admin business status error:", error);
    return NextResponse.json({ error: "Unable to update business status." }, { status: 500 });
  }
}
