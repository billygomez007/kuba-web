import { db } from "@/db";
import { platformAuditLogs } from "@/db/schema";

type PlatformAuditEvent = {
  actorUserId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  result: "success" | "denied" | "failure";
  metadata?: Record<string, unknown>;
};

export async function createPlatformAuditLog({
  actorUserId = null,
  action,
  targetType,
  targetId = null,
  result,
  metadata = {},
}: PlatformAuditEvent) {
  await db.insert(platformAuditLogs).values({
    id: crypto.randomUUID(),
    actorUserId,
    action,
    targetType,
    targetId,
    result,
    metadata: JSON.stringify(metadata),
    createdAt: new Date(),
  });
}
