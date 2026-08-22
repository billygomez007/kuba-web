import { resend } from "./resend";
import { welcomeEmailTemplate } from "./templates";

export async function sendWelcomeEmail(
  email: string,
  name: string
) {
  const emailTemplate = welcomeEmailTemplate({ name });

  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: email,
    replyTo: process.env.EMAIL_REPLY_TO!,
    subject: emailTemplate.subject,
    html: emailTemplate.html,
    text: emailTemplate.text,
  });
}
