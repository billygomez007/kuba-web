# SuperKuba Payments Integration Audit

## Scope

This audit covers payment and billing code in `app/`, `lib/`, `mastra/`, `db/schema.ts`, `tests/`, and `docs/`. It distinguishes SuperKuba platform billing from customer-facing merchant payment collection.

## Capability Matrix

| Capability | Classification | Schema | API/UI | Provider/webhook | Tenant security | Status |
| --- | --- | --- | --- | --- | --- | --- |
| SuperKuba subscription checkout | Platform billing | `subscriptions` | `/api/billing/checkout`, Billing UI | Stripe or Paystack | Membership-scoped | Fully operational when configured |
| Subscription state and entitlements | Platform billing | `subscriptions`, `entitlement_overrides` | `/api/billing/usage` | Stripe/Paystack webhook and callback | Business-scoped persistence | Fully operational when configured |
| Billing portal and cancellation | Platform billing | `subscriptions` | `/api/billing/portal`, `/api/billing/subscription` | Stripe portal; provider cancellation | Membership and billing permissions | Partial, provider-dependent |
| Stripe merchant account connection | Business payment | None | None | None | None | Missing |
| Paystack merchant account connection | Business payment | None | None | None | None | Missing |
| Customer payment links, invoices, charges, refunds | Business payment | None | None | None | None | Missing |
| Business payment webhook mapping | Business payment | None | None | None | None | Missing |
| AI payment/refund tool | Business payment | None | None | None | None | Missing |
| Collections Agent payment workflow | Future | None | AI Workforce placeholder only | None | None | Coming Soon |

## Platform Billing

Platform billing is implemented in `lib/billing/provider.ts`, `lib/billing/entitlements.ts`, and `lib/billing/subscription-service.ts`.

- Stripe supports hosted subscription checkout, billing portal, plan changes, cancellation, resume capability metadata, and signed webhook parsing.
- Paystack supports hosted subscription checkout, transaction verification, recurring subscription state, cancellation, and signed webhook parsing. It does not provide the same billing portal or plan-change capabilities.
- `app/api/billing/checkout/route.ts` starts subscription checkout and stores no merchant payment connection.
- `app/api/billing/webhooks/stripe/route.ts` and `app/api/billing/webhooks/paystack/route.ts` update the business subscription.
- Settings billing UI is under `/dashboard/billing`; it reports plan, provider, entitlements, usage, checkout, portal, and cancellation state.

These providers must remain classified as **Platform Billing Only** under Integrations.

## Business Merchant Payments

No operational business merchant payment capability exists. The generic `integrations` table has no payment-specific contract, and there are no payment transaction, invoice, payment-link, refund, or merchant-account APIs. No customer payment can be associated with a customer, lead, conversation, or task.

The Payments page therefore reports **Not Configured** and provides no connect or payment action controls.

## Security and Permissions

- Platform billing routes resolve the authenticated membership and use existing `workforce.manage`, `billing.view`, or `billing.manage` permissions as appropriate.
- Billing persistence is filtered by the resolved business membership.
- Stripe webhook signatures use timing-safe comparison and a timestamp tolerance. Subscription event deduplication uses `providerEventId`.
- Paystack webhooks validate the HMAC signature and map the subscription using trusted metadata. There is no business-payment webhook.
- Provider secrets are read from environment variables or encrypted integration storage where applicable; they are not returned by the Payments page or public integration status.
- No refund API or AI payment/refund tool exists. AI employees receive no payment authority.

## Future Requirements

Before merchant payments can leave Coming Soon, the system needs a tenant-scoped merchant connection model, encrypted provider credentials or delegated account authorization, provider-specific webhook event storage with signature and replay/idempotency protection, payment/customer/lead linkage, amount and currency validation from server-side records, permissions for viewing/managing payment connections and approved payment/refund actions, and a human approval path for sensitive actions. Collections Agent would additionally need invoice visibility, payment-link creation, reminders, status confirmation, receipts, escalation, and human approval.

No schema, migration, or production database changes were made for this audit.