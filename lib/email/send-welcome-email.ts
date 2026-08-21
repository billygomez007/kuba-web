import { resend } from "./resend";

export async function sendWelcomeEmail(
  email: string,
  name: string
) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    replyTo: process.env.EMAIL_REPLY_TO!,
    subject: "Welcome to SuperKuba 🚀",
    html: `
      <h1>Welcome to SuperKuba, ${name}!</h1>

      <p>
        Your AI workforce is ready.
      </p>

      <p>
        Thank you for joining SuperKuba.
        We are excited to help your business work smarter with AI.
      </p>

      <br />

      <p>
        The SuperKuba Team
      </p>
    `,
  });
}
