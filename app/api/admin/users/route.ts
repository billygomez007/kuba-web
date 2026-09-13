import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

/** Platform-admin user search — the lookup step before granting a platform role via PATCH /api/admin/users/[id]. */
export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!await isPlatformAdmin(session.user.id)) return NextResponse.json({ error: "Platform admin access required." }, { status: 403 });

  const search = new URL(request.url).searchParams.get("search")?.trim().toLowerCase() || "";
  const rows = await db.select({ id: users.id, name: users.name, email: users.email, platformRole: users.platformRole, status: users.status }).from(users);
  const matched = rows.filter((row) => !search || `${row.name} ${row.email}`.toLowerCase().includes(search)).slice(0, 25);
  return NextResponse.json({ users: matched });
}
