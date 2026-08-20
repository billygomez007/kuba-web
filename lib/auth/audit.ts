import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type CreateAuditLogInput = {
  businessId: string;
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createAuditLog({
  businessId,
  userId = null,
  action,
  resource,
  resourceId = null,
  description = null,
  metadata = {},
  ipAddress = null,
  userAgent = null,
}: CreateAuditLogInput) {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    businessId,
    userId,
    action,
    resource,
    resourceId,
    description,
    metadata: JSON.stringify(metadata),
    ipAddress,
    userAgent,
    createdAt: new Date(),
  });
}
