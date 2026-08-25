import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
} from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";


async function requireBusinessId() {
  const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    } as const;
  }

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      ),
    } as const;
  }
  if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) } as const;
  return { businessId: membership.businessId } as const;
}


export async function POST(
  request: Request,
) {

  const auth_ = await requireBusinessId();
  if ("error" in auth_) return auth_.error;


  const {
    employeeId,
    channel,
    recipient,
    message,
  } = await request.json();


  if(
    !channel ||
    !recipient ||
    !message
  ){

    return NextResponse.json(
      {
        error:"Missing action details",
      },
      {
        status:400,
      },
    );

  }


  await db.insert(actionApprovals).values({

    id:
      crypto.randomUUID(),

    businessId:
      auth_.businessId,

    employeeId:
      employeeId || null,

    channel,

    recipient,

    message,

    status:
      "pending",

    createdAt:
      new Date(),

    updatedAt:
      new Date(),

  });


  return NextResponse.json({
    success:true,
  });

}


export async function GET() {

  const auth_ = await requireBusinessId();
  if ("error" in auth_) return auth_.error;

  const actions =
    await db
      .select()
      .from(actionApprovals)
      .where(
        eq(actionApprovals.businessId, auth_.businessId),
      );


  return NextResponse.json({
    actions,
  });

}


export async function PATCH(
  request: Request,
) {

  const auth_ = await requireBusinessId();
  if ("error" in auth_) return auth_.error;

  const {
    actionId,
    status,
  } = await request.json();


  if(!actionId || !status){

    return NextResponse.json(
      {
        error:"Missing data",
      },
      {
        status:400,
      },
    );

  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be approved or rejected." },
      { status: 400 },
    );
  }


  const updated = await db
    .update(actionApprovals)
    .set({
      status,
      updatedAt:new Date(),
    })
    .where(
      and(
        eq(actionApprovals.id, actionId),
        eq(actionApprovals.businessId, auth_.businessId),
        eq(actionApprovals.status, "pending"),
      ),
    )
    .returning();

  if (!updated[0]) {
    return NextResponse.json(
      { error: "Approval request not found or already decided." },
      { status: 404 },
    );
  }


  return NextResponse.json({
    success:true,
  });

}
