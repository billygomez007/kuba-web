# SuperKuba Plan Entitlements & Tiered Experience Audit

## Existing architecture

SuperKuba already has one subscription architecture: `businesses.plan`, `subscriptions`, and `entitlement_overrides`. `lib/billing/entitlements.ts` remains the canonical source for plan identifiers, plan definitions, subscription-state fallback, feature limits, and active support overrides. There is no `business_modules` table or active add-on architecture; the resolver returns an empty module list so that layer can be added later without changing plan consumers.

## Capability model

Stable capability identifiers now cover the approved operating-system areas: Command Center, AI Workforce, Human Workforce, Customer Operations, Business Operations, Intelligence, Integrations, Business Brain, admin controls, and Enterprise hierarchy/governance. Plans resolve to capability sets rather than page-level plan checks. The normalized contract is:

```text
BusinessEntitlements {
  plan, planName, capabilities, limits, modules
}
```

`getBusinessEntitlements`, `hasCapability`, and the compatibility-preserving `getBusinessPlan` API are in `lib/billing/entitlements.ts`.

## Plan matrix

| Plan | Intended capability surface |
| --- | --- |
| Starter | Basic command center, core AI workforce, Inbox, Customers, Leads, Follow-ups, communication integrations, Business Brain core/sources, team staff, billing |
| Growth | Starter plus builder, AI teams, deployment, monitoring, Conversations, Handoffs, Business Operations tasks/approvals/automations, basic Analytics, documents, memory, instructions |
| Pro | Growth plus Human Workforce, HR, attendance, leave, payroll, AI orchestration/performance/voice/simulator/marketplace, advanced Operations, Intelligence, broader integrations, Business Brain management |
| Enterprise | Full capability set, including Collections Agent, organization/multi-business, group command center, cross-business analytics, advanced governance, branches, roles/permissions, and all future platform areas |

Entitlement does not imply implementation. For example, Enterprise may be entitled to Inventory while the current Inventory experience remains Coming Soon until its operational backend exists.

## Limits and overrides

The resolver represents `max_ai_employees`, `max_human_users`, `max_businesses`, `max_branches`, `max_knowledge_sources`, `max_automations`, `max_api_keys`, `max_monthly_conversations`, `max_storage_mb`, and included voice minutes. Existing `entitlement_overrides` are additive: active `grant_feature` overrides add capabilities, while `limit` overrides increase or set the corresponding normalized limit. No module/add-on rows currently exist, so precedence is base plan -> future modules -> active overrides.

## Authorization and enforcement

`/api/auth/me` now returns the selected business's effective plan, capabilities, and limits without provider secrets. The dashboard layout projects the sidebar by capability and shows an upgrade-required surface on direct navigation to a non-entitled route. Existing RBAC checks remain separate and continue to run first. Representative API gates return HTTP 403 with `FEATURE_NOT_ENTITLED` for Analytics, Human Workforce, Integrations, Automations, and Workflow Templates. Resource ownership and selected-business authorization remain unchanged.

## Billing, lifecycle, and safety

Stripe and Paystack remain platform subscription billing providers under Settings -> Billing & Subscription. Checkout, subscription state, entitlements, usage, provider webhooks, and billing portal/cancellation are not merchant payment integrations. Downgrade behavior does not delete data; premium data remains stored while gated functionality becomes unavailable. Legacy businesses continue to use the existing `businesses.plan` fallback when no usable subscription exists. No production billing transaction or database operation was used.

The current schema has no business module/add-on or multi-business entitlement persistence beyond existing memberships and overrides. No schema change is required for this foundation. A future implementation will need additive module/entitlement persistence only when commercial add-ons or richer business limits are approved.

## QA coverage

`tests/entitlements-policy.test.mjs` covers Starter, Growth, Pro, Enterprise, overrides, limits, RBAC plus entitlement, foreign/stale business denial, sidebar projections, downgrade preservation, enterprise multi-business limits, Coming Soon separation, and secret non-exposure. Existing tests continue to cover tenant and permission policy.