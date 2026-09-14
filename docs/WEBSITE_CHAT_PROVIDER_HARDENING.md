# Website chat provider hardening

This document covers the provider-side contract used by the SuperKuba website
chat widget. It is intentionally separate from Kora's marketing-site widget
integration.

## Request flow

```text
browser public key + Origin
  -> integrations lookup (provider = website_chat, status = active)
  -> exact configured-origin check
  -> business/receptionist/routing resolution
  -> conversation and message processing
```

The `kuba_pk_*` value is a public browser identifier. It is not a secret and
does not authorize dashboard, administrative, configuration, credential, or
cross-business access. The website-chat endpoint resolves the business only
from the active integration record, and the supplied `conversationId` must
belong to that same integration and business.

## Allowed origins

Active website-chat integrations now have an additive nullable
`integrations.allowed_origins` field containing a JSON array of exact origins.
The migration is `drizzle/0045_superkuba_widget_origins.sql`.

- `null` or an empty database value keeps existing integrations on the
  documented legacy compatibility path while they are migrated.
- A configured array enables strict enforcement.
- An empty array or malformed configured JSON fails closed.
- The request's actual `Origin` header is normalized and compared exactly.
- Schemes, hosts, ports, paths, credentials, suffixes, and wildcards are not
  treated as interchangeable. Missing or malformed `Origin` is rejected when
  an allowlist exists.
- Unknown public keys and origin denials use the same generic 403 response so
  callers cannot enumerate integrations.

### Serialized-origin grammar

Configured origins and request Origins must first match `https://host` or
`https://host:port`. The host is an ASCII URL hostname (IDNs use punycode), a
canonical dotted IPv4 address, or a bracketed canonical IPv6 address. The
optional port is an unpadded decimal integer from 0 through 65535. URL parsing
then validates the host and port; it must not repair or rewrite the hostname
other than changing its case. No implicit localhost or HTTP exception exists.

Scheme/host casing is normalized, and explicit HTTPS port `443` is equivalent
to an omitted port. Other ports remain distinct and must be configured exactly.
A trailing slash is rejected, including `/` by itself. Paths, userinfo, empty
or nonempty query/fragment delimiters, percent-encoded hostnames, whitespace,
multiple origins, commas, wildcards, missing slashes, and opaque origins such
as `null` are rejected before URL canonicalization. Non-HTTPS configuration
fails closed. Any future local HTTP support requires a separate explicit policy.

For example, `HTTPS://KoraAfric.COM:443` normalizes to
`https://koraafric.com`; `https:koraafric.com`, `https:/koraafric.com`,
`https://koraafric.com/`, `https://koraafric.com?`, and
`https://koraafric.com#` are invalid. An otherwise well-formed foreign hostname
still fails the configured origin comparison.

The legacy null/empty database allowlist exception remains unchanged: it
bypasses application-level origin enforcement but supplies no browser CORS
headers. All active browser integrations must be explicitly configured before
provider promotion.

The approved Kora production configuration is exactly:

```json
["https://koraafric.com", "https://www.koraafric.com"]
```

## Migration deployment prerequisite

The widget-origin migration was renamed to `0045_superkuba_widget_origins`
to avoid existing migration-number collisions. Its SQL and snapshot contents
are unchanged. The journal retains `idx: 38` and `when: 1789341443148`; the
snapshot still links to the intended `0038` baseline. The filename prefix is
not the journal ordinal.

Drizzle decides which migrations are pending using journal timestamps and the
production ledger. The reviewed production ledger's latest timestamp was
`1788117804308`, earlier than this migration's `1789341443148`. However, the
reviewed main branch ends at `0038`, while production already records later
migrations through `0041`. Renaming this migration does not reconcile that
history or solve future deployment of older-timestamp branch migrations,
which the runner could skip after a newer timestamp is recorded.

Before deployment, independently recheck the production ledger and effective
pending migration set, and review the ordering of any other branch migrations.
Do not replay or reconcile unrelated migrations as part of this change. Apply
the reviewed additive migration and configure every active browser integration's
exact origins before deploying the provider; legacy null allowlists do not
receive browser CORS headers.

The release-specific dispositions and exact object inventory are recorded in
[the migration reconciliation](WEBSITE_CHAT_MIGRATION_RECONCILIATION.md).
The split `0040`/`0041` migrations are superseded. Both `0042` identities and
the outreach/organization `0043`/`0044` migrations are excluded from this
provider release. Their later rollout must use a newly reviewed migration
plan with timestamps after the then-current production ledger; the historical
files must not be assumed to run after `0045`. Fresh production schema checks
remain an execution gate, not a test result inferred from this branch.

Run `node --experimental-strip-types --test tests/website-chat-*.test.mjs`
for the provider regression and migration-plan checks. The route tests use
ephemeral local SQLite and actual Drizzle/schema lookups for OPTIONS and POST
authorization. They verify query/body key mismatch isolation and zero handler
writes. AI generation and a complete successful conversation are outside this
focused harness; no production connection is used.

## Browser CORS contract

The public widget sends its `kuba_pk_*` identifier in both the JSON body and a
query parameter. The query parameter is intentionally public and lets the
provider resolve the integration during the browser's `OPTIONS` preflight,
before a JSON body exists. The provider returns a `204` preflight only when
the active integration has a configured allowlist and the request `Origin`
matches exactly.

Approved preflight and successful POST responses contain only the exact origin
headers needed by the widget:

```text
Access-Control-Allow-Origin: <exact configured origin>
Vary: Origin
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

The provider never emits a wildcard origin or credential support. Unknown
keys, missing or malformed origins, and origin denials receive the same
generic 403 response without CORS headers. Legacy `null`/empty allowlists keep
their application-level compatibility behavior but do not receive a browser
CORS response until an administrator configures an allowlist.

The public widget calls the canonical provider host
`https://www.superkuba.com` directly. `https://superkuba.com` redirects to
that host, and preflight requests must not depend on following that redirect.

No production or staging database was changed in this branch. After the
migration has been applied, an authorized operator can inspect the target row:

```sql
SELECT id, provider, status, public_key, allowed_origins
FROM integrations
WHERE provider = 'website_chat'
  AND public_key = 'kuba_pk_vTotgdmtY9HvQgdbH84ZVzJHQ75oSpl2jFeJsqxg4pE';
```

If the row is the Kora integration, the separately authorized data change is:

```sql
UPDATE integrations
SET allowed_origins = '["https://koraafric.com","https://www.koraafric.com"]',
    updated_at = unixepoch() * 1000
WHERE provider = 'website_chat'
  AND public_key = 'kuba_pk_vTotgdmtY9HvQgdbH84ZVzJHQ75oSpl2jFeJsqxg4pE';
```

Do not run that mutation without explicit production-data authorization. Do
not add localhost, Vercel previews, wildcard hosts, or HTTP origins to the
production row.

## Welcome-message contract

`public/kuba/chat.js` keeps the visible title (`Kuba AI`) separate from the
conversation greeting. A non-empty `data-welcome` value is trimmed and safely
truncated to 500 characters, then rendered as the first `Kuba` message. The
value is inserted with `textContent`/`createTextNode`; HTML and script content
never becomes markup. Empty or absent `data-welcome` preserves the existing
generic behavior (title plus input placeholder).

The active website-chat endpoint does not currently fetch `websiteWidgets` or
a provider-stored welcome message. Therefore the current precedence is:

1. page-level `data-welcome`;
2. existing generic provider UI fallback.

If provider-backed welcome configuration is activated later, it should be the
default behind an explicit page-level `data-welcome` override.

The runtime also marks its launcher and panel so duplicate script insertion
does not create duplicate chat instances or welcome messages.

## Lifecycle and privacy

The provider still does not expose a safe `hide`, `show`, or `destroy` API;
Kora hides provider-owned nodes during private-route navigation. A future
provider lifecycle API could make that transition cleaner, but it is outside
this hardening scope.

The widget does not read Kora cookies, browser auth tokens, OTPs, account IDs,
or private credentials. No tracking, fingerprinting, analytics, or automatic
PII collection was added.
