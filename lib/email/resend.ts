import { Resend } from "resend";

let resend: Resend | null = null;

export function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is required to send email.");
  }
  resend ??= new Resend(apiKey);
  return resend;
}
