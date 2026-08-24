import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businessUsers, users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { createAuditLog } from "@/lib/auth/audit";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isPlatformAdmin(session.user.id)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });
  const { id: businessId } = await context.params;
  const body = await request.json();
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!userId || !email || !reason) return NextResponse.json({ error: "userId, email, and reason are required." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const member = await db.select({ userId: businessUsers.userId }).from(businessUsers).where(and(eq(businessUsers.businessId, businessId), eq(businessUsers.userId, userId))).limit(1);
  if (!member[0]) return NextResponse.json({ error: "Business member not found." }, { status: 404 });
  const duplicate = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (duplicate[0] && duplicate[0].id !== userId) return NextResponse.json({ error: "That email address is already in use." }, { status: 409 });
  await db.update(users).set({ email, emailVerified: false, updatedAt: new Date() }).where(eq(users.id, userId));
  await createAuditLog({ businessId, userId: session.user.id, action: "admin.member_email.changed", resource: "user", resourceId: userId, description: reason, metadata: { emailVerified: false } });
  return NextResponse.json({ success: true });
}
