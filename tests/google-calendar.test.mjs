import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MockGoogleCalendarProvider } from "./google-calendar-mock-provider.mjs";
const { buildGoogleEvent, hasBusyConflict } = await import("../lib/google-calendar-logic.ts");

test("Google Calendar uses the existing tenant-scoped integrations and encrypted credential fields", () => {
  const source = fs.readFileSync("lib/google-calendar.ts", "utf8");
  assert.match(source, /GOOGLE_PROVIDER = "google_calendar"/);
  assert.match(source, /credentialsEncrypted/);
  assert.match(source, /encrypt\(JSON\.stringify/);
  assert.match(source, /eq\(integrations\.businessId, businessId\)/);
});

test("Google Calendar OAuth requests only Calendar scope and protects state", () => {
  const source = fs.readFileSync("app/api/integrations/google-calendar/route.ts", "utf8");
  assert.match(source, /calendar"/);
  assert.match(source, /signState\(payload\)/);
  assert.match(source, /getCurrentMembership/);
  assert.doesNotMatch(source, /gmail|drive/i);
});

test("Google Calendar callback verifies state and never returns tokens", () => {
  const source = fs.readFileSync("app/api/integrations/google-calendar/callback/route.ts", "utf8");
  assert.match(source, /verifyState/);
  assert.match(source, /refresh_token/);
  assert.doesNotMatch(source, /NextResponse\.json\(\{[^}]*accessToken/);
});

test("Calendar UI keeps Outlook and Apple Calendar Coming Soon", () => {
  const source = fs.readFileSync("app/dashboard/integrations/calendar/page.tsx", "utf8");
  assert.match(source, /Connect Google Calendar/);
  assert.match(source, /Outlook and Apple Calendar remain Coming Soon/);
});

test("appointments retain canonical rows and add Google linkage only after event creation", () => {
  const source = fs.readFileSync("app/api/appointments/route.ts", "utf8");
  assert.match(source, /createGoogleEvent/);
  assert.match(source, /externalEventId/);
  assert.match(source, /calendarSync/);
});

test("busy interval overlap is deterministic and timezone-safe", () => {
  const start = new Date("2026-01-05T10:00:00Z");
  const end = new Date("2026-01-05T11:00:00Z");
  assert.equal(hasBusyConflict(start, end, [{ start: "2026-01-05T10:30:00Z", end: "2026-01-05T11:30:00Z" }]), true);
  assert.equal(hasBusyConflict(start, end, [{ start: "2026-01-05T11:00:00Z", end: "2026-01-05T12:00:00Z" }]), false);
});

test("Google event payload preserves appointment timezone and stable identity", () => {
  const event = buildGoogleEvent({ id: "apt-1", title: "Consultation", startAt: new Date("2026-01-05T10:00:00Z"), endAt: new Date("2026-01-05T11:00:00Z"), timezone: "Africa/Accra" });
  assert.equal(event.start.timeZone, "Africa/Accra");
  assert.match(event.description, /apt-1/);
});

test("mock provider deterministically covers OAuth, calendar, availability, and event lifecycle endpoints", async () => {
  const mock = new MockGoogleCalendarProvider().install();
  try {
    await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token" }) });
    await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList");
    await fetch("https://www.googleapis.com/calendar/v3/freeBusy", { method: "POST", body: JSON.stringify({}) });
    await fetch("https://www.googleapis.com/calendar/v3/calendars/calendar-a/events", { method: "POST", body: JSON.stringify({ summary: "safe" }) });
    await fetch("https://www.googleapis.com/calendar/v3/calendars/calendar-a/events/mock-event-1", { method: "PATCH", body: JSON.stringify({ summary: "updated" }) });
    await fetch("https://www.googleapis.com/calendar/v3/calendars/calendar-a/events/mock-event-1", { method: "DELETE" });
    assert.equal(mock.calls.length, 6);
    assert.equal(mock.count("POST", "/calendar/v3/calendars/calendar-a/events"), 1);
    assert.equal(mock.calls.some((call) => call.body?.includes("mock-access-token")), false);
  } finally { mock.restore(); }
});

test("Google Calendar Phase 4 release contract and tenant safety remain explicit in source", () => {
  const source = fs.readFileSync("lib/google-calendar.ts", "utf8");
  const route = fs.readFileSync("app/api/integrations/google-calendar/route.ts", "utf8");
  const callback = fs.readFileSync("app/api/integrations/google-calendar/callback/route.ts", "utf8");
  assert.match(source, /eq\(integrations\.businessId, businessId\)/);
  assert.match(source, /google_calendar\.reconciliation_required/);
  assert.match(source, /refresh_token/);
  assert.match(route, /sync_succeeded/);
  assert.match(route, /sync_failed/);
  assert.match(route, /calendarList/);
  assert.match(callback, /payload\.userId/);
  assert.match(callback, /membership\.businessId !== payload\.businessId/);
  assert.doesNotMatch(source, /watch|push notification|two-way realtime/i);
});
