const BRAND_NAME = "SuperKuba";
const DEFAULT_APP_URL = "https://superkuba.com";

type EmailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type BrandedEmailOptions = {
  preheader: string;
  eyebrow?: string;
  title: string;
  greeting: string;
  body: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  notice?: string;
};

type RecipientTemplateOptions = {
  name: string;
};

type ActionTemplateOptions = RecipientTemplateOptions & {
  actionUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
}

function logoUrl(): string {
  return `${appUrl()}/brand/superkuba-logo.png`;
}

function renderBrandedEmail(options: BrandedEmailOptions): Omit<EmailTemplate, "subject"> {
  const safePreheader = escapeHtml(options.preheader);
  const safeTitle = escapeHtml(options.title);
  const safeGreeting = escapeHtml(options.greeting);
  const safeEyebrow = options.eyebrow ? escapeHtml(options.eyebrow) : "";
  const safeNotice = options.notice ? escapeHtml(options.notice) : "";
  const safeCtaLabel = options.ctaLabel ? escapeHtml(options.ctaLabel) : "";
  const safeCtaUrl = options.ctaUrl ? escapeHtml(options.ctaUrl) : "";
  const bodyHtml = options.body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 18px;color:#cbd5e1;font-family:Arial,'Helvetica Neue',sans-serif;font-size:16px;line-height:26px;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#050507;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#050507;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;">
            <tr>
              <td align="center" style="padding:8px 24px 28px;">
                <img src="${escapeHtml(logoUrl())}" width="196" alt="SuperKuba" style="display:block;width:196px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td style="border:1px solid #26263a;border-radius:24px;background-color:#0d0d14;padding:48px 44px;box-shadow:0 20px 60px rgba(26,97,255,0.14);">
                ${safeEyebrow ? `<p style="margin:0 0 14px;color:#67e8f9;font-family:Arial,'Helvetica Neue',sans-serif;font-size:12px;font-weight:700;line-height:18px;letter-spacing:1.6px;text-transform:uppercase;">${safeEyebrow}</p>` : ""}
                <h1 style="margin:0 0 24px;color:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;font-size:32px;font-weight:700;line-height:40px;letter-spacing:-0.6px;">${safeTitle}</h1>
                <p style="margin:0 0 18px;color:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;font-size:17px;font-weight:600;line-height:27px;">${safeGreeting}</p>
                ${bodyHtml}
                ${safeCtaLabel && safeCtaUrl ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:30px 0 26px;"><tr><td align="center" bgcolor="#2563eb" style="border-radius:12px;background:linear-gradient(135deg,#2563eb 0%,#7c3aed 100%);"><a href="${safeCtaUrl}" style="display:inline-block;padding:15px 26px;color:#ffffff;font-family:Arial,'Helvetica Neue',sans-serif;font-size:16px;font-weight:700;line-height:20px;text-decoration:none;">${safeCtaLabel}</a></td></tr></table>` : ""}
                ${safeNotice ? `<p style="margin:24px 0 0;padding:16px 18px;border:1px solid #2b2b40;border-radius:12px;background-color:#151521;color:#94a3b8;font-family:Arial,'Helvetica Neue',sans-serif;font-size:13px;line-height:20px;">${safeNotice}</p>` : ""}
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 24px 8px;color:#64748b;font-family:Arial,'Helvetica Neue',sans-serif;font-size:12px;line-height:19px;">
                <p style="margin:0 0 8px;">SuperKuba · Your intelligent workforce platform</p>
                <p style="margin:0;">© ${new Date().getUTCFullYear()} SuperKuba. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    options.title,
    "",
    options.greeting,
    "",
    ...options.body.flatMap((paragraph) => [paragraph, ""]),
    ...(options.ctaLabel && options.ctaUrl
      ? [options.ctaLabel, options.ctaUrl, ""]
      : []),
    ...(options.notice ? [options.notice, ""] : []),
    `${BRAND_NAME} · Your intelligent workforce platform`,
  ].join("\n");

  return { html, text };
}

export function welcomeEmailTemplate({ name }: RecipientTemplateOptions): EmailTemplate {
  const subject = "Welcome to SuperKuba — Your AI Workforce Starts Here";
  return {
    subject,
    ...renderBrandedEmail({
      preheader: "Welcome to SuperKuba. Your intelligent workforce starts here.",
      eyebrow: "Welcome to SuperKuba",
      title: "Your AI workforce starts here",
      greeting: `Hello ${name},`,
      body: [
        "Welcome to SuperKuba. We are delighted to help you build a smarter, more responsive business with an intelligent workforce that works alongside your team.",
        "From one command center, SuperKuba helps you deploy AI employees, manage customer operations, automate workflows, and turn business activity into actionable insight.",
        "Your workspace is ready. Sign in to begin setting up your business and activating your first AI employee.",
      ],
      ctaLabel: "Open your dashboard",
      ctaUrl: `${appUrl()}/dashboard`,
    }),
  };
}

export function verificationEmailTemplate({ name, actionUrl }: ActionTemplateOptions): EmailTemplate {
  const subject = "Verify your SuperKuba email address";
  return {
    subject,
    ...renderBrandedEmail({
      preheader: "Verify your email address to secure your SuperKuba account.",
      eyebrow: "Account verification",
      title: "Verify your email address",
      greeting: `Hello ${name},`,
      body: ["Confirm that this email address belongs to you to finish securing your SuperKuba account."],
      ctaLabel: "Verify email address",
      ctaUrl: actionUrl,
      notice: "If you did not create a SuperKuba account, you can safely ignore this email.",
    }),
  };
}

export function emailChangeConfirmationTemplate({
  name,
  newEmail,
  actionUrl,
}: RecipientTemplateOptions & { newEmail: string; actionUrl: string }): EmailTemplate {
  const subject = "Confirm your new SuperKuba email address";
  return {
    subject,
    ...renderBrandedEmail({
      preheader: `Confirm the change to ${newEmail} on your SuperKuba account.`,
      eyebrow: "Account security",
      title: "Confirm your new email address",
      greeting: `Hello ${name},`,
      body: [
        `Someone signed into your SuperKuba account requested to change the login email to ${newEmail}.`,
        "Use the secure link below to confirm this change. Your login email will remain unchanged until verification is completed.",
      ],
      ctaLabel: "Confirm Email Address",
      ctaUrl: actionUrl,
      notice: "If you did not request this change, you can ignore this email and your current login email will stay the same.",
    }),
  };
}

export function teamInvitationEmailTemplate(
  options: ActionTemplateOptions & { businessName: string; inviterName: string },
): EmailTemplate {
  const subject = `You have been invited to join ${options.businessName} on SuperKuba`;
  return {
    subject,
    ...renderBrandedEmail({
      preheader: `${options.inviterName} invited you to join ${options.businessName} on SuperKuba.`,
      eyebrow: "Team invitation",
      title: "Join your team on SuperKuba",
      greeting: `Hello ${options.name},`,
      body: [`${options.inviterName} has invited you to join ${options.businessName} and collaborate in its SuperKuba workspace.`],
      ctaLabel: "Accept invitation",
      ctaUrl: options.actionUrl,
      notice: "Only accept this invitation if you recognize the organization and the person who invited you.",
    }),
  };
}

export function passwordResetEmailTemplate({ name, actionUrl }: ActionTemplateOptions): EmailTemplate {
  const subject = "Reset your SuperKuba password";
  return {
    subject,
    ...renderBrandedEmail({
      preheader: "Use this secure link to reset your SuperKuba password.",
      eyebrow: "Password assistance",
      title: "Reset your password",
      greeting: `Hello ${name},`,
      body: ["We received a request to reset the password for your SuperKuba account. Use the secure link below to choose a new password."],
      ctaLabel: "Reset password",
      ctaUrl: actionUrl,
      notice: "If you did not request a password reset, ignore this email and your password will remain unchanged.",
    }),
  };
}

export function aiEmployeeActivationEmailTemplate(
  options: RecipientTemplateOptions & { aiEmployeeName: string; dashboardUrl?: string },
): EmailTemplate {
  const subject = `${options.aiEmployeeName} is active on SuperKuba`;
  return {
    subject,
    ...renderBrandedEmail({
      preheader: `${options.aiEmployeeName} is ready to work in your SuperKuba workspace.`,
      eyebrow: "AI workforce update",
      title: "Your AI employee is ready",
      greeting: `Hello ${options.name},`,
      body: [`${options.aiEmployeeName} has been activated successfully and is ready to support your business within its assigned permissions.`],
      ctaLabel: "View AI workforce",
      ctaUrl: options.dashboardUrl || `${appUrl()}/dashboard/ai-workforce`,
    }),
  };
}

export function contactSalesEmailTemplate(
  options: { name: string; email: string; company: string; message: string },
): EmailTemplate {
  const subject = `New Enterprise contact request — ${options.company}`;
  return {
    subject,
    ...renderBrandedEmail({
      preheader: `${options.name} from ${options.company} asked to be contacted about SuperKuba Enterprise.`,
      eyebrow: "Enterprise contact request",
      title: "New Enterprise inquiry",
      greeting: `${options.name} (${options.email}) at ${options.company} submitted the Contact Sales form:`,
      body: [options.message],
      notice: "Reply directly to this email to respond to the requester.",
    }),
  };
}

export function securityNotificationEmailTemplate(
  options: RecipientTemplateOptions & { eventDescription: string; securityUrl?: string },
): EmailTemplate {
  const subject = "Security notification from SuperKuba";
  return {
    subject,
    ...renderBrandedEmail({
      preheader: "Please review recent security activity on your SuperKuba account.",
      eyebrow: "Security notification",
      title: "Review recent account activity",
      greeting: `Hello ${options.name},`,
      body: [options.eventDescription, "If you recognize this activity, no action is required."],
      ctaLabel: "Review account security",
      ctaUrl: options.securityUrl || `${appUrl()}/dashboard/settings`,
      notice: "If you do not recognize this activity, secure your account immediately and contact SuperKuba support.",
    }),
  };
}
