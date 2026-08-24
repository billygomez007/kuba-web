import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { platformManagers, users } from "@/db/schema";

export async function isPlatformAdmin(userId: string) {
  const user = (await db.select({ platformRole: users.platformRole, status: users.status }).from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user || user.status !== "active") return false;
  if (["platform_admin", "super_admin", "system_operator"].includes(user.platformRole)) return true;
  const manager = (await db.select({ id: platformManagers.id }).from(platformManagers).where(and(eq(platformManagers.userId, userId), eq(platformManagers.status, "active"))).limit(1))[0];
  return Boolean(manager);
}