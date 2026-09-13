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
The migration is `drizzle/0039_superkuba_widget_origins.sql`.

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

The approved Kora production configuration is exactly:

```json
["https://koraafric.com", "https://www.koraafric.com"]
```

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
