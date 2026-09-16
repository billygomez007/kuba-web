/** Deterministic Google Calendar HTTP boundary used by integration tests. */
export class MockGoogleCalendarProvider {
  constructor() {
    this.calls = [];
    this.responses = new Map();
    this.failures = new Map();
    this.tokens = { access_token: "mock-access-token", refresh_token: "mock-refresh-token", expires_in: 3600, scope: "https://www.googleapis.com/auth/calendar" };
    this.calendars = [{ id: "calendar-a", summary: "Business A", accessRole: "owner", primary: true }, { id: "calendar-b", summary: "Business B", accessRole: "writer", primary: false }];
    this.busy = [];
    this.events = new Map();
  }
  key(method, url) { return `${method.toUpperCase()} ${new URL(url).pathname}`; }
  respond(method, path, body, status = 200) { this.responses.set(`${method.toUpperCase()} ${path}`, { body, status }); return this; }
  fail(method, path, error = new Error("mock network failure")) { this.failures.set(`${method.toUpperCase()} ${path}`, error); return this; }
  count(method, path) { return this.calls.filter((c) => c.method === method.toUpperCase() && c.path === path).length; }
  install() {
    this.originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => this.fetch(input, init);
    return this;
  }
  restore() { if (this.originalFetch) globalThis.fetch = this.originalFetch; }
  async fetch(input, init = {}) {
    const url = String(input); const method = String(init.method || "GET").toUpperCase(); const path = new URL(url).pathname;
    let body = init.body; if (body && typeof body !== "string") body = body instanceof URLSearchParams ? body.toString() : String(body);
    const call = { method, url, path, body: body || null, headers: Object.fromEntries(new Headers(init.headers || {}).entries()) }; this.calls.push(call);
    const key = this.key(method, url); const failure = this.failures.get(key); if (failure) throw failure;
    if (path === "/oauth2.googleapis.com/token" || url.includes("oauth2.googleapis.com/token")) return new Response(JSON.stringify(this.tokens), { status: this.responses.get(key)?.status || 200, headers: { "content-type": "application/json" } });
    if (url.includes("oauth2/v3/userinfo")) return new Response(JSON.stringify({ email: "owner@example.test" }), { status: 200, headers: { "content-type": "application/json" } });
    const configured = this.responses.get(key); if (configured) return new Response(JSON.stringify(configured.body ?? {}), { status: configured.status, headers: { "content-type": "application/json" } });
    if (path.endsWith("/calendarList")) return new Response(JSON.stringify({ items: this.calendars }), { status: 200, headers: { "content-type": "application/json" } });
    if (path.endsWith("/freeBusy")) return new Response(JSON.stringify({ calendars: { "calendar-a": { busy: this.busy }, "calendar-b": { busy: this.busy } } }), { status: 200, headers: { "content-type": "application/json" } });
    if (path.includes("/events/") && method === "DELETE") return new Response(null, { status: this.responses.get(key)?.status || 204 });
    if (path.includes("/events/") && method === "PATCH") return new Response(JSON.stringify({ id: path.split("/").pop() }), { status: 200, headers: { "content-type": "application/json" } });
    if (path.includes("/events") && method === "POST") { const id = `mock-event-${this.events.size + 1}`; this.events.set(id, body); return new Response(JSON.stringify({ id }), { status: 200, headers: { "content-type": "application/json" } }); }
    if (path.includes("/calendars/") && method === "GET") return new Response(JSON.stringify({ id: path.split("/").pop(), summary: "Selected calendar", accessRole: "writer" }), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ error: { message: "unhandled mock endpoint" } }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

