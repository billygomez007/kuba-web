import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { runAutomationTrigger } from "@/lib/automations/engine";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { rejectBusinessOverride } from "@/lib/operations/policy";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";

import {
  aiEmployees,
  automations,
  businessUsers,
  customers,
  leads,
  tasks,
} from "@/db/schema";

async function tasksNotEntitledResponse(businessId: string) {
  const entitlements = await getBusinessEntitlements(businessId);
  if (hasCapability(entitlements, "business_ops.tasks")) return null;
  return NextResponse.json(
    { error: "Tasks require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["business_ops.tasks"] },
    { status: 403 },
  );
}

async function invalidTaskRelation(body: Record<string, unknown>, businessId: string) {
  const checks = [
    ["assignedUserId", businessUsers, businessUsers.userId, businessUsers.businessId],
    ["assignedEmployeeId", aiEmployees, aiEmployees.id, aiEmployees.businessId],
    ["leadId", leads, leads.id, leads.businessId],
    ["customerId", customers, customers.id, customers.businessId],
    ["automationId", automations, automations.id, automations.businessId],
  ] as const;
  for (const [key, table, idColumn, businessColumn] of checks) {
    const value = body[key];
    if (value === undefined || value === null || value === "") continue;
    const found = await db.select({ id: idColumn }).from(table).where(and(eq(idColumn, String(value)), eq(businessColumn, businessId))).limit(1);
    if (!found[0]) return key;
  }
  return null;
}

async function getBusinessId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      session: null,
      membership: null,
      businessId: null,
    };
  }

  const membership = await getCurrentMembership();

  return {
    session,
    membership,
    businessId: membership?.businessId || null,
  };
}

export async function GET() {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.TASKS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const notEntitled = await tasksNotEntitledResponse(businessId);
    if (notEntitled) return notEntitled;

    const result = await db
      .select()
      .from(tasks)
      .where(
        eq(
          tasks.businessId,
          businessId,
        ),
      )
      .orderBy(
        desc(tasks.createdAt),
      );

    return NextResponse.json({
      tasks: result,
    });
  } catch (error) {
    console.error("Tasks GET error:", error);

    return NextResponse.json(
      { error: "Unable to load tasks." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.TASKS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const notEntitled = await tasksNotEntitledResponse(businessId);
    if (notEntitled) return notEntitled;

    const body = await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });
    const invalidRelation = await invalidTaskRelation(body, businessId);
    if (invalidRelation) return NextResponse.json({ error: `${invalidRelation} does not belong to the selected business.` }, { status: 400 });

    const title = String(
      body.title || "",
    ).trim();

    if (!title) {
      return NextResponse.json(
        { error: "Task title is required." },
        { status: 400 },
      );
    }

    const description = body.description
      ? String(body.description).trim()
      : null;

    const allowedStatuses = [
      "pending",
      "in_progress",
      "completed",
      "cancelled",
    ];

    const status = allowedStatuses.includes(
      body.status,
    )
      ? body.status
      : "pending";

    const allowedPriorities = [
      "low",
      "normal",
      "high",
      "urgent",
    ];

    const priority = allowedPriorities.includes(
      body.priority,
    )
      ? body.priority
      : "normal";

    let dueAt: Date | null = null;

    if (body.dueAt) {
      const parsed = new Date(body.dueAt);

      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json(
          { error: "Invalid due date." },
          { status: 400 },
        );
      }

      dueAt = parsed;
    }

    const now = new Date();
    const taskId = crypto.randomUUID();

    await db.insert(tasks).values({
      id: taskId,
      businessId,

      title,
      description,

      status,
      priority,

      assignedUserId:
        body.assignedUserId
          ? String(body.assignedUserId)
          : null,

      assignedEmployeeId:
        body.assignedEmployeeId
          ? String(body.assignedEmployeeId)
          : null,

      leadId:
        body.leadId
          ? String(body.leadId)
          : null,

      customerId:
        body.customerId
          ? String(body.customerId)
          : null,

      automationId:
        body.automationId
          ? String(body.automationId)
          : null,

      dueAt,

      completedAt:
        status === "completed"
          ? now
          : null,

      createdAt: now,
      updatedAt: now,
    });
    await createAuditLog({ businessId, userId: session.user.id, action: "task.created", resource: "task", resourceId: taskId, description: title, metadata: { status, priority } });

    try {
      await runAutomationTrigger({
        businessId,
        trigger: "task.created",
        data: {
          taskId,
          title,
          status,
          priority,
          leadId: body.leadId || null,
          customerId: body.customerId || null,
        },
      });
    } catch (automationError) {
      console.error("Task automation error:", automationError);
    }

    const created = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      )
      .limit(1);

    return NextResponse.json(
      {
        success: true,
        task: created[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Tasks POST error:", error);

    return NextResponse.json(
      { error: "Unable to create task." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.TASKS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const notEntitled = await tasksNotEntitledResponse(businessId);
    if (notEntitled) return notEntitled;

    const body = await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });
    const invalidRelation = await invalidTaskRelation(body, businessId);
    if (invalidRelation) return NextResponse.json({ error: `${invalidRelation} does not belong to the selected business.` }, { status: 400 });

    const taskId = String(
      body.id || "",
    ).trim();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required." },
        { status: 400 },
      );
    }

    const existing = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json(
        { error: "Task not found." },
        { status: 404 },
      );
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.title !== undefined) {
      const title = String(
        body.title || "",
      ).trim();

      if (!title) {
        return NextResponse.json(
          {
            error:
              "Task title cannot be empty.",
          },
          { status: 400 },
        );
      }

      updates.title = title;
    }

    if (body.description !== undefined) {
      updates.description = body.description
        ? String(body.description).trim()
        : null;
    }

    if (body.status !== undefined) {
      const allowedStatuses = [
        "pending",
        "in_progress",
        "completed",
        "cancelled",
      ];

      if (
        !allowedStatuses.includes(
          body.status,
        )
      ) {
        return NextResponse.json(
          { error: "Invalid task status." },
          { status: 400 },
        );
      }

      updates.status = body.status;

      updates.completedAt =
        body.status === "completed"
          ? new Date()
          : null;
    }

    if (body.priority !== undefined) {
      const allowedPriorities = [
        "low",
        "normal",
        "high",
        "urgent",
      ];

      if (
        !allowedPriorities.includes(
          body.priority,
        )
      ) {
        return NextResponse.json(
          {
            error:
              "Invalid task priority.",
          },
          { status: 400 },
        );
      }

      updates.priority = body.priority;
    }

    if (
      body.assignedUserId !== undefined
    ) {
      updates.assignedUserId =
        body.assignedUserId
          ? String(body.assignedUserId)
          : null;
    }

    if (
      body.assignedEmployeeId !== undefined
    ) {
      updates.assignedEmployeeId =
        body.assignedEmployeeId
          ? String(body.assignedEmployeeId)
          : null;
    }

    if (body.dueAt !== undefined) {
      if (!body.dueAt) {
        updates.dueAt = null;
      } else {
        const parsed = new Date(
          body.dueAt,
        );

        if (Number.isNaN(parsed.getTime())) {
          return NextResponse.json(
            { error: "Invalid due date." },
            { status: 400 },
          );
        }

        updates.dueAt = parsed;
      }
    }

    await db
      .update(tasks)
      .set(updates as typeof updates)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      );
    const auditAction = body.status === "completed" ? "task.completed" : body.assignedUserId !== undefined || body.assignedEmployeeId !== undefined ? "task.reassigned" : "task.updated";
    await createAuditLog({ businessId, userId: session.user.id, action: auditAction, resource: "task", resourceId: taskId, description: existing[0].title, metadata: { changedFields: Object.keys(body).filter((key) => key !== "id" && key !== "businessId") } });

    const updated = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      task: updated[0],
    });
  } catch (error) {
    console.error(
      "Tasks PATCH error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to update task." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.TASKS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const notEntitled = await tasksNotEntitledResponse(businessId);
    if (notEntitled) return notEntitled;

    const body = await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });

    const taskId = String(
      body.id || "",
    ).trim();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required." },
        { status: 400 },
      );
    }

    const deleted = await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      ).returning({ id: tasks.id, title: tasks.title });

    if (!deleted[0]) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    await createAuditLog({ businessId, userId: session.user.id, action: "task.deleted", resource: "task", resourceId: taskId, description: deleted[0].title });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Tasks DELETE error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to delete task." },
      { status: 500 },
    );
  }
}
