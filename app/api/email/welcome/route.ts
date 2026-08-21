import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendWelcomeEmail } from "@/lib/email/send-welcome-email";
import { rateLimit } from "@/lib/api/rate-limit";

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, {
      namespace: "welcome-email",
      limit: 3,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name } = await req.json();

    if (typeof email !== "string" || email.toLowerCase() !== session.user.email.toLowerCase()) {
      return NextResponse.json({ error: "Invalid welcome email recipient." }, { status: 403 });
    }

    await sendWelcomeEmail(email, typeof name === "string" ? name : session.user.name);

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
