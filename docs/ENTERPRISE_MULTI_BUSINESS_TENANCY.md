# Enterprise multi-business tenancy

## Boundary

An organization (portfolio) groups businesses for administration and
discovery. It is not an operational tenant. Every business has an immutable
`business.id`; business-scoped reads and writes must resolve that ID and must
also require an explicit `businessUsers` membership.

`organization_members` and `organization_businesses` provide grouping and
management metadata. Organization membership alone never grants access to a
child business. Business names, owner email addresses, and the first
membership row are not tenant identifiers.

## Switching and routing

The selected business cookie contains a business ID. The selection endpoint
checks the authenticated user's `businessUsers` membership before setting it.
The canonical current-business resolver rejects an invalid or ambiguous
selection rather than falling back to a parent organization or a name match.
Portfolio “open workspace” actions use the linked child business ID and then
reload business-scoped data.

This makes duplicate names safe: two businesses called `Kora OS` remain
independent tenants and can only be selected by their IDs and explicit
memberships.

## Isolation requirements

Integrations, Website Widget keys and origins, AI employees, Business Brain,
Inbox/conversations, customers, campaigns, analytics, email, and voice/Plivo
records are resolved from the selected business ID. A public Website Widget
key maps to one business; origin checks and receptionist/brain lookups stay on
that same business. Organization membership must never replace this check.

Entitlements are also business-scoped. The current policy resolves a plan from
the business's own subscription; portfolio membership does not inherit a
parent plan into a child business.

## Provisioning rules

Use the supported business creation flow. It creates a new business ID and an
explicit owner `businessUsers` row, then optionally links the business to an
organization. Linking does not copy integrations, customers, brains, or
conversations and does not change ownership.

Before production provisioning, identify the canonical owner and canonical
business by immutable ID. Duplicate names must be reviewed rather than
merged. Activate Website Chat through the selected-business UI so the service
generates a fresh public key, then configure only that business's approved
origins.

## Current production limitation

The September 2026 production database has the Website Widget origins column
from migration 0045, but it does not contain the organization/portfolio
tables present on the feature branch. Production Kora provisioning and
linking therefore require a separately authorized schema rollout and a
confirmed canonical Kora owner. No production Kora rows are created by this
audit.
