import crypto from "crypto";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const scopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar",
];

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function stateSecret() {
  return process.env.GOOGLE_INTEGRATION_STATE_SECRET?.trim() ||
    required("ENCRYPTION_KEY");
}

export function createGoogleState(input: {
  businessId: string;
  userId: string;
}) {
  const payload = Buffer.from(JSON.stringify({
    businessId: input.businessId,
    userId: input.userId,
    issuedAt: Date.now(),
    nonce: crypto.randomBytes(16).toString("hex"),
  })).toString("base64url");

  const signature = crypto
    .createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");

  return `${payload}.${signature}`;
}

export function verifyGoogleState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) throw new Error("Invalid OAuth state.");

  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(payload)
    .digest();

  const supplied = Buffer.from(signature, "base64url");

  if (
    expected.length !== supplied.length ||
    !crypto.timingSafeEqual(expected, supplied)
  ) throw new Error("Invalid OAuth state signature.");

  const parsed = JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as {
    businessId: string;
    userId: string;
    issuedAt: number;
    nonce: string;
  };

  if (
    !parsed.businessId ||
    !parsed.userId ||
    !parsed.issuedAt ||
    Date.now() - parsed.issuedAt > 15 * 60 * 1000
  ) throw new Error("Expired OAuth state.");

  return parsed;
}

export function googleAuthorizationUrl(state: string) {
  const url = new URL(AUTH_URL);

  url.searchParams.set("client_id", required("GOOGLE_INTEGRATION_CLIENT_ID"));
  url.searchParams.set(
    "redirect_uri",
    required("GOOGLE_INTEGRATION_REDIRECT_URI"),
  );
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeGoogleCode(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: required("GOOGLE_INTEGRATION_CLIENT_ID"),
      client_secret: required("GOOGLE_INTEGRATION_CLIENT_SECRET"),
      redirect_uri: required("GOOGLE_INTEGRATION_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
      data.error ||
      "Google token exchange failed.",
    );
  }

  return data as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
}

async function googleGet(path: string, accessToken: string) {
  const response = await fetch(`${CALENDAR_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || "Google Calendar API request failed.",
    );
  }

  return data;
}

export async function getGoogleCalendarIdentity(accessToken: string) {
  const calendar = await googleGet(
    "/calendars/primary",
    accessToken,
  );

  return {
    id: String(calendar.id),
    summary: String(calendar.summary || "Google Calendar"),
    timeZone: calendar.timeZone ? String(calendar.timeZone) : null,
  };
}

export async function listGoogleCalendars(accessToken: string) {
  const data = await googleGet("/users/me/calendarList", accessToken);

  return Array.isArray(data.items)
    ? data.items.map((item: any) => ({
        id: String(item.id),
        summary: String(item.summary || item.id),
        primary: Boolean(item.primary),
        accessRole: item.accessRole ? String(item.accessRole) : null,
        timeZone: item.timeZone ? String(item.timeZone) : null,
      }))
    : [];
}
