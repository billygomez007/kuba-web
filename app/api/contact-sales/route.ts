import { NextResponse } from "next/server";

import { resend } from "@/lib/email/resend";
import { contactSalesEmailTemplate } from "@/lib/email/templates";
import { rateLimit } from "@/lib/api/rate-limit";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, {
      namespace: "contact-sales",
      limit: 5,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const company = String(body.company || "").trim();
    const message = String(body.message || "").trim();

    if (!name || !company || !message) {
      return NextResponse.json({ error: "Name, company, and message are required." }, { status: 400 });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const salesInbox = process.env.SALES_CONTACT_EMAIL || process.env.EMAIL_REPLY_TO;
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !salesInbox) {
      return NextResponse.json(
        { error: "Contact Sales is not configured for this environment yet. Please email us directly.", code: "CONFIGURATION_REQUIRED" },
        { status: 503 },
      );
    }

    const template = contactSalesEmailTemplate({ name, email, company, message });

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: salesInbox,
      replyTo: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Contact Sales submission error:", error);
    return NextResponse.json({ error: "Unable to send your message. Please try again." }, { status: 500 });
  }
}
