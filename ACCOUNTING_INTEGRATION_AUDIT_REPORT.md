# SuperKuba Accounting Integration Audit

## Result

Integrations -> Accounting is **Coming Soon**. No external accounting connector is operational in the repository.

| Capability | Internal or external | Schema | API | UI | Provider/OAuth/webhook | Tenant security | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| QuickBooks Online | External | None | None | Placeholder only | None | Not applicable | Future |
| Xero | External | None | None | Placeholder only | None | Not applicable | Future |
| Sage | External | None | None | Placeholder only | None | Not applicable | Future |
| Zoho Books | External | None | None | Placeholder only | None | Not applicable | Future |
| FreshBooks, Wave, Odoo | External | None | None | None | None | Not applicable | Missing/Future |
| Subscription billing | Internal platform billing | `subscriptions` | `/api/billing/*` | Settings -> Billing | Stripe/Paystack subscription webhooks | Business membership scoped | Operational when configured |
| Payroll | Internal Human Workforce | Payroll tables | Human Workforce API | Payroll UI | No external accounting sync | Business scoped and permission gated | Internal operational/read-only surface |
| Sales and financial analytics | Internal operational data | Leads, conversations, activities | Analytics APIs | Intelligence UI | No accounting source | Business scoped | Not an accounting ledger |

## Forensic findings

- There is no QuickBooks/Intuit OAuth flow, callback, state store, realm/company handling, token refresh service, disconnect route, sync job, or webhook.
- There is no Xero OAuth flow, tenant connection, token refresh service, sync job, or webhook.
- No Sage, Zoho Books, FreshBooks, Wave, Odoo, or generic accounting connector exists.
- `integrations` is a generic registry with no accounting-specific contract; it does not make a provider operational by listing a name.
- The existing `subscriptions` table and Stripe/Paystack billing routes are for SuperKuba subscription billing, not a customer business accounting connection.
- Payroll tables and APIs remain under Human Workforce and are not an accounting ledger or external accounting sync.
- Sales, leads, customer, conversation, and analytics records are operational data. They must not be labeled profit/loss, cash flow, balance sheet, accounts receivable/payable, tax liability, or general ledger data without an authoritative accounting source.
- No chart of accounts, journal-entry model, ledger, invoice sync, expense sync, bank feed, reconciliation, or financial export service was found.
- No Mastra tool grants AI employees authority to create journal entries, alter books, reconcile accounts, change tax records, create payments, or modify payroll.

## Security and future requirements

The current page exposes no connection controls, tokens, provider IDs, or fake Connected state. Existing permission vocabulary includes `accounting.view`, `accounting.manage`, and `accounting.ai`; any future connector must use these together with `integrations.view/manage` as appropriate. Provider callbacks must derive tenant identity from validated OAuth state and trusted provider metadata, never a raw callback `businessId`. Future work requires additive tenant-scoped accounting connection and sync persistence, encrypted token storage, OAuth state/expiry validation, provider webhook verification and idempotency, ownership checks, audit events, sync error handling, and explicit policies for sensitive financial data.

Future Intelligence financial reporting and Collections Agent receivables workflows must depend on authoritative Payments or Accounting sources. No Collections Agent or accounting mutation behavior was implemented.

No schema, migration, journal, database, provider credential, or production change was made.