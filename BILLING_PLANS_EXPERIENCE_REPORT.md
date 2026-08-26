# SuperKuba Billing, Plans & Upgrade Experience Audit

## Operational matrix

| Capability | Current implementation | Provider | Server enforcement | UI | Status |
| --- | --- | --- | --- | --- | --- |
| Plan resolution | `businesses.plan` fallback plus usable `subscriptions` state | Stripe/Paystack/internal | `getBusinessEntitlements` | Billing and Plans | Operational |
| Entitlement resolution | Canonical plan capabilities, limits, and active overrides | Internal | Shared resolver and route gates | Sidebar/upgrade guard | Operational |
| Subscription checkout | Hosted checkout for paid Growth/Pro plans | Stripe or Paystack | Authenticated membership and provider confirmation | Plans page | Operational when configured |
| Enterprise upgrade | Sales-only response | None | Checkout rejects Enterprise | Contact Sales mailto CTA | Manual/sales flow only |
| Downgrade | No self-serve downgrade endpoint | Provider-dependent | Checkout rejects non-upgrades | Downgrade button is non-actionable | Not implemented |
| Cancellation | Provider cancellation request | Stripe/Paystack | `billing.manage` | Billing page | Partial/provider-dependent |
| Usage | Operational records for employees, automations, voice, conversations, and more | Internal | Employee/automation create paths enforce limits | Billing/Usage pages | Mixed; some limits untracked |
| Billing history/invoices/tax | No dedicated provider history projection | Stripe/Paystack | Not applicable | Not shown | Missing |

## Platform billing separation

Stripe and Paystack are used for SuperKuba subscription billing under Settings -> Billing & Subscription. They are not business merchant payment integrations, business revenue, or customer payment records. Integrations -> Payments remains separate and unavailable for merchant collection.

## Plan comparison

Billing Plans now consumes the canonical `/api/billing/plans` definitions and derives human-readable capability categories from capability namespaces. It does not display internal capability IDs or invented prices. Starter, Growth, Pro, and Enterprise are presented with intended audience copy, canonical AI employee/automation/voice limits, category areas, current-plan state, and appropriate actions. Enterprise uses a non-mutating Contact Sales mailto fallback and does not auto-grant access.

## Upgrade and lifecycle truth

The browser can request checkout, but it cannot grant entitlements. The server rejects Starter checkout, Enterprise self-serve checkout, and target plans that are not strictly higher than the selected business's current canonical plan. Subscription state changes only through provider-confirmed webhook/callback persistence. Existing plan resolution supports active, trialing, past-due, canceled, enterprise-contract, and fallback states; product policy for grace periods and cancellation effective timing remains a commercial decision.

Downgrade behavior is intentionally non-destructive: no data deletion is performed. Existing records remain available for future reactivation, while plan gates and creation limits control access. Over-limit downgrade UX and provider-specific effective timing still need an approved product policy.

## Usage and limits

Currently enforced limits are AI employees and automations. Voice minutes are measured when call duration/billable minutes exist and compared with the plan allowance. Conversations, messages, runs, calls, knowledge sources, and integrations are tracked where records exist, but most have no plan limit. `max_human_users`, `max_businesses`, `max_branches`, `max_api_keys`, `max_monthly_conversations`, and `max_storage_mb` are represented centrally but not comprehensively enforced. Untracked limits are presented as not currently tracked rather than fake progress.

## Security

Billing APIs derive the selected business from authenticated membership and scope subscription/usage queries by business ID. Existing Stripe timestamp/HMAC timing-safe checks, Paystack HMAC checks, event deduplication, and callback verification remain in place. Provider secrets and webhook secrets are not returned to the UI. Billing permissions remain distinct from plan entitlements.

No schema, migration, journal, production database, production credential, live charge, refund, or production billing mutation was used. Remaining work includes a provider-backed downgrade/change-plan policy, authoritative billing history/invoice/tax projection, explicit past-due grace policy, annual/trial/add-on decisions, and a supported Enterprise sales intake endpoint if mailto is insufficient.
