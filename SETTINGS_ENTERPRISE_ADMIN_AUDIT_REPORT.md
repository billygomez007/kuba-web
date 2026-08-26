# SuperKuba Settings, Enterprise Administration & Account Security Audit

## Scope and classification

This pass audited the existing Better Auth session architecture, selected-business context, Settings pages, Team Staff and invitation APIs, roles/permissions, branches, billing/entitlements, audit logging, and platform-admin separation.

| Capability | Classification | Current truth |
| --- | --- | --- |
| Business Profile | Partially operational | Existing fields persist through the selected business and now create an audit event. |
| Organization / Business Group | Missing / Coming Soon | No customer organization or group schema/API exists. |
| Branches & Locations | Partially operational | Branch data exists and is tenant-scoped; no complete branch-management UI or creation limit enforcement was added. |
| Team Staff | Operational with safeguards | Membership listing and mutation APIs exist with RBAC, tenant ownership, role grant restrictions, branch validation, and last-owner protection. |
| Invitations | Operational lifecycle | Creation, expiry, duplicate protection, acceptance, and email binding exist. Raw tokens are no longer returned by the create response. |
| Roles & Permissions | Operational RBAC | Existing built-in roles and permission vocabulary are reused. Custom roles are not fabricated. |
| Security / Account | Partially operational | Better Auth account security and current-session sign-out exist; broader session inventory/MFA/security-event UI is not present. |
| Billing & Subscription | Operational when configured | Existing platform billing and entitlement architecture remains unchanged. |
| Preferences | Limited | Existing Settings/AI settings are reused; no new fake preference controls were added. |
| Sign Out | Operational | Existing `authClient.signOut()` is now available in Settings and the desktop/mobile dashboard shells for every plan and role. |

## Authentication and logout

Better Auth is configured in `lib/auth.ts` with the Drizzle adapter and session storage. The canonical client is `lib/auth-client.ts`, and `LogoutControl` calls `authClient.signOut()` rather than manually deleting session cookies. Before termination it calls the existing authenticated `DELETE /api/businesses/select` endpoint to clear the `superkuba_business_id` cookie. Only after successful cleanup does it terminate the Better Auth session and redirect to `/login`. Failures restore the button and show a non-sensitive retry message.

The dashboard shell renders the same control on desktop and mobile, so it is not dependent on Settings permissions, billing state, plan entitlement, or enterprise access. Better Auth middleware remains authoritative for post-logout route protection.

## Tenant and administration hardening

Business Profile reads and mutations now resolve `getCurrentMembership()` and therefore respect selected-business context instead of selecting the first membership. Profile updates remain server-derived, validate the business name, reject non-admin roles, and write a minimal audit event.

Team Staff mutations remain scoped by membership business ID. Branch assignments must belong to that business. The last owner cannot be demoted or removed. Invitation listing remains minimized and invitation creation no longer returns the raw token or invitation URL. Existing invitation acceptance verifies pending state, expiry, role validity, and the authenticated user's email.

Enterprise customers remain limited to explicit memberships. Platform Super Admin is a separate authorization path and is not inherited by customer Enterprise roles.

## Unsupported features

Organization/group governance, full branch management, custom roles, all-session inventory/revocation, MFA, login history, security events, and broader preferences are not operational in the current schema/API surface. They remain absent or Coming Soon rather than being represented as fake controls. No schema or migration change was required or made.

## Validation coverage

`tests/settings-security-policy.test.mjs` covers all-plan and all-role sign-out availability, RBAC independence, session termination sequencing, post-logout denial, login redirect, selected-business cleanup, cross-user context isolation, Upgrade Required availability, safe failure handling, secret non-exposure, profile ownership, stale context, and last-owner policy. Existing tenant, permission, entitlement, and invitation tests remain part of the full suite.
