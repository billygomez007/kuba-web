import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  automations,
  businessUsers,
} from "@/db/schema";


async function getBusinessId() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return {
      session: null,
      businessId: null,
    };
  }

  const membership =
    await db
      .select({
        businessId:
          businessUsers.businessId,
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


function validateAutomation(body: Record<string, unknown>) {
  const name =
    String(body.name || "").trim();

  const description =
    body.description
      ? String(body.description).trim()
      : null;

  const trigger =
    String(body.trigger || "").trim();

  const conditions =
    body.conditions ?? [];

  const actions =
    body.actions ?? [];

  const status =
    body.status === "paused"
      ? "paused"
      : "active";

  if (!name) {
    throw new Error(
      "Automation name is required.",
    );
  }

  if (!trigger) {
    throw new Error(
      "Automation trigger is required.",
    );
  }

  if (!Array.isArray(conditions)) {
    throw new Error(
      "Automation conditions must be an array.",
    );
  }

  if (
    !Array.isArray(actions) ||
    actions.length === 0
  ) {
    throw new Error(
      "Automation must contain at least one action.",
    );
  }

  return {
    name,
    description,
    trigger,
    conditions,
    actions,
    status,
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
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const results =
      await db
        .select()
        .from(automations)
        .where(
          eq(
            automations.businessId,
            businessId,
          ),
        )
        .orderBy(
          desc(
            automations.createdAt,
          ),
        );

    return NextResponse.json({
      automations: results,
    });
  } catch (error) {
    console.error(
      "Automation GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load automations.",
      },
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
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const body =
      await request.json();

    const validated =
      validateAutomation(body);

    const now =
      new Date();

    const automation = {
      id:
        crypto.randomUUID(),

      businessId,

      name:
        validated.name,

      description:
        validated.description,

      trigger:
        validated.trigger,

      conditions:
        JSON.stringify(
          validated.conditions,
        ),

      actions:
        JSON.stringify(
          validated.actions,
        ),

      status:
        validated.status,

      createdAt:
        now,

      updatedAt:
        now,
    };

    await db
      .insert(automations)
      .values(automation);

    return NextResponse.json(
      {
        success: true,
        automation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Automation POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create automation.",
      },
      { status: 400 },
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
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const body =
      await request.json();

    const id =
      String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Automation ID is required.",
        },
        { status: 400 },
      );
    }

    const validated =
      validateAutomation(body);

    const result =
      await db
        .update(automations)
        .set({
          name:
            validated.name,

          description:
            validated.description,

          trigger:
            validated.trigger,

          conditions:
            JSON.stringify(
              validated.conditions,
            ),

          actions:
            JSON.stringify(
              validated.actions,
            ),

          status:
            validated.status,

          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              automations.id,
              id,
            ),
            eq(
              automations.businessId,
              businessId,
            ),
          ),
        )
        .returning();

    if (!result[0]) {
      return NextResponse.json(
        {
          error:
            "Automation not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      automation:
        result[0],
    });
  } catch (error) {
    console.error(
      "Automation PATCH error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update automation.",
      },
      { status: 400 },
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
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const body =
      await request.json();

    const id =
      String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Automation ID is required.",
        },
        { status: 400 },
      );
    }

    const result =
      await db
        .delete(automations)
        .where(
          and(
            eq(
              automations.id,
              id,
            ),
            eq(
              automations.businessId,
              businessId,
            ),
          ),
        )
        .returning({
          id: automations.id,
        });

    if (!result[0]) {
      return NextResponse.json(
        {
          error:
            "Automation not found.",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Automation DELETE error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to delete automation.",
      },
      { status: 500 },
    );
  }
}
