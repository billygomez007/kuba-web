import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  tickets,
} from "@/db/schema";


async function getBusinessForUser(userId: string) {
  const result = await db
    .select({
      business: businesses,
    })
    .from(businessUsers)
    .innerJoin(
      businesses,
      eq(
        businessUsers.businessId,
        businesses.id,
      ),
    )
    .where(
      eq(
        businessUsers.userId,
        userId,
      ),
    )
    .limit(1);

  return result[0]?.business;
}



export async function GET() {

  try {

    const session =
      await auth.api.getSession({
        headers: await headers(),
      });


    if (!session?.user) {

      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );

    }


    const business =
      await getBusinessForUser(
        session.user.id,
      );


    if (!business) {

      return NextResponse.json(
        {
          error:
            "No business is associated with this account.",
        },
        {
          status: 404,
        },
      );

    }



    const result =
      await db
        .select()
        .from(tickets)
        .where(
          eq(
            tickets.businessId,
            business.id,
          ),
        )
        .orderBy(
          desc(
            tickets.createdAt,
          ),
        );



    return NextResponse.json({
      tickets: result,
    });



  } catch(error) {

    console.error(
      "Ticket fetch error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load tickets.",
      },
      {
        status:500,
      },
    );

  }

}




export async function POST(
  request: Request,
) {

  try {

    const session =
      await auth.api.getSession({
        headers: await headers(),
      });


    if (!session?.user) {

      return NextResponse.json(
        {
          error:
            "You must be signed in.",
        },
        {
          status:401,
        },
      );

    }



    const business =
      await getBusinessForUser(
        session.user.id,
      );


    if (!business) {

      return NextResponse.json(
        {
          error:
            "No business is associated with this account.",
        },
        {
          status:404,
        },
      );

    }



    const body =
      await request.json();


    const title =
      String(body.title || "").trim();

    const description =
      String(body.description || "").trim();


    if (!title) {

      return NextResponse.json(
        {
          error:
            "Ticket title is required.",
        },
        {
          status:400,
        },
      );

    }



    const ticketId =
      crypto.randomUUID();


    const now =
      new Date();



    await db.insert(tickets)
      .values({

        id: ticketId,

        businessId:
          business.id,

        customerId:
          body.customerId || null,

        title,

        description:
          description || null,

        status:
          "open",

        priority:
          body.priority || "medium",

        category:
          body.category || null,

        assignedEmployeeId:
          body.assignedEmployeeId || null,

        createdAt:
          now,

        updatedAt:
          now,

      });



    const created =
      await db
        .select()
        .from(tickets)
        .where(
          eq(
            tickets.id,
            ticketId,
          ),
        )
        .limit(1);



    return NextResponse.json(
      {
        success:true,
        ticket:created[0],
      },
      {
        status:201,
      },
    );



  } catch(error) {

    console.error(
      "Ticket creation error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to create ticket.",
      },
      {
        status:500,
      },
    );

  }

}
