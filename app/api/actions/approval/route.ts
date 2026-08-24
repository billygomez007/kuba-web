import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  businessUsers,
} from "@/db/schema";


async function requireBusinessId(request: Request) {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    } as const;
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
    })
    .from(businessUsers)
    .where(eq(businessUsers.userId, session.user.id))
    .limit(1);

  const business = membership[0];

  if (!business) {
    return {
      error: NextResponse.json(
        { error: "No business is associated with this account." },
        { status: 404 },
      ),
    } as const;
  }

  return { businessId: business.businessId } as const;
}


export async function POST(
  request: Request,
) {

  const auth_ = await requireBusinessId(request);
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


export async function GET(request: Request) {

  const auth_ = await requireBusinessId(request);
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

  const auth_ = await requireBusinessId(request);
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
