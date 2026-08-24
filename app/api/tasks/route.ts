import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { runAutomationTrigger } from "@/lib/automations/engine";

import {
  businessUsers,
  tasks,
} from "@/db/schema";

async function getBusinessId() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      session: null,
      businessId: null,
    };
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
    })
    .from(businessUsers)
    .where(
      eq(
        businessUsers.userId,
        session.user.id,
      ),
    )
    .limit(1);

  return {
    session,
    businessId:
      membership[0]?.businessId || null,
  };
}

export async function GET() {
  try {
    const {
      session,
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

    const body = await request.json();

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

    const body = await request.json();

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

    const body = await request.json();

    const taskId = String(
      body.id || "",
    ).trim();

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required." },
        { status: 400 },
      );
    }

    await db
      .delete(tasks)
      .where(
        and(
          eq(tasks.id, taskId),
          eq(
            tasks.businessId,
            businessId,
          ),
        ),
      );

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
