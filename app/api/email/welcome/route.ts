import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";

export async function POST(req: Request) {
  try {
    const { email, name } = await req.json();

    await sendWelcomeEmail(email, name);

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error("Welcome email error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to send welcome email",
      },
      {
        status: 500,
      }
    );
  }
}
