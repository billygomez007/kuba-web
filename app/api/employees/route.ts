import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { authorizationErrorResponse, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

/**
 * Existing AI workforce directory. Human workforce records will use a separate
 * employee domain once its schema and migration lineage are safely established.
 */
export async function GET(request: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.WORKFORCE_VIEW, request);
    const employees = await db.select().from(aiEmployees).where(eq(aiEmployees.businessId, context.business.id));
    return NextResponse.json({ success: true, employees });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("AI workforce directory error:", error);
    return NextResponse.json({ error: "Unable to load AI workforce." }, { status: 500 });
  }
}
