import { NextResponse } from "next/server";

export async function POST(
  request: Request,
) {
  try {

    const body = await request.json();

    const message =
      String(body.message || "").trim();


    if (!message || message.length > 4000) {
      return NextResponse.json(
        {
          error: "Message is required and must be at most 4,000 characters.",
        },
        {
          status: 400,
        },
      );
    }


    // Temporary Kuba response
    // Later this connects to AI employee engine

    return NextResponse.json({
      response:
        `Kuba received your message: "${message}". I am ready to assist you.`,
    });


  } catch (error) {

    console.error(
      "Widget chat error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to process message.",
      },
      {
        status: 500,
      },
    );
  }
}
