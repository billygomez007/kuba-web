# Human Workforce, Inventory, and Collections Architecture

## Status and delivery boundary

This document defines the approved domain boundary for Kuba's expansion from an AI workforce platform into an operations platform. It is intentionally not a substitute for schema migrations or financial workflows.

The current Drizzle journal has duplicate/unregistered migrations. Before introducing HR, payroll, inventory, receivable, payment, or ledger tables, migration lineage must be reconciled and the migration path exercised against a staging copy of production data.

## Existing reusable foundations

| Existing Kuba capability | Reuse in new domains |
| --- | --- |
| `businesses`, `business_users`, branches, teams | Tenant, human employee assignment, approval scope, locations |
| `customers` | Canonical customer identity for sales and collections |
| tasks, automations, approvals, audit logs | Workflows, approvals, immutable operational history |
| conversations, messages, integrations | Authorized collection communications and activity timeline |
| AI employees and controlled action security | HR/Collections assistance, never direct financial release |
| permissions and active business context | Least-privilege server-side access controls |

## Proposed bounded contexts

### Human Workforce and HR

Create a dedicated human employee identity linked optionally to an application user. Do not reuse `ai_employees` for people. The initial scope should include employee profile, employment status/history, departments, positions, manager relationship, secure documents, and employment contract metadata.

Attendance, leave, recruitment, performance, and self-service should be separate subdomains. Employee documents must use authenticated, tenant-scoped retrieval rather than public URLs.

### Payroll

Payroll must be a versioned, append-only financial domain. Store all money as integer minor units plus ISO currency code. Payroll rules follow:

`country → ruleset → version → effective period → payroll run`

Payroll run states must be `draft → calculated → reviewed → approved → finalized → paid`. Finalization is immutable; corrections use adjustments or reversals. AI can prepare summaries but cannot approve or release payroll.

### Inventory

Products are shared business entities; services and non-stock items remain valid products without stock tracking. Inventory must use a movement ledger rather than overwrite quantity. Available stock is derived from balances, reservations, and movements by business and location.

Initial entities: product categories, products, variants, warehouses/locations, inventory balances, inventory movements, suppliers, and purchase orders. Transfers, counts, batches, expiry, and reservations build on the same immutable movement model.

### Receivables and Collections

Collections extends the existing customer identity; it must not create a second customer model. Receivables track original amount, paid amount, outstanding amount, due date, currency, payment status, collection status, and assigned collector. Payments and allocations remain append-only financial records.

Collection policies define contact hours, channel, frequency, exclusions, disputes, and escalation. Collections AI can recommend or draft communications. Write-offs, material discounts, legal escalation, payment reversals, and credit overrides require explicit authorization/approval.

## Cross-domain event boundaries

Use existing automation/action infrastructure first; introduce durable event infrastructure only after throughput requires it.

| Event | Producer | Consumer / outcome |
| --- | --- | --- |
| Sale completed | Sales | reserve/reduce stock where configured |
| Invoice created | Sales/finance | create receivable |
| Payment received | Receivables | allocate payment, update balance/case |
| Leave approved | HR | attendance/calendar update |
| Payroll finalized | Payroll | lock run and publish payslip availability |
| Stock low | Inventory | task/notification/reorder recommendation |

Every event payload must contain the business ID, source record ID, actor, correlation ID, timestamp, and idempotency key.

## Permission model

New permissions should be added before new APIs, with no implicit finance/salary grants to existing roles. Proposed groups:

- HR: employee view/manage, document view/manage, attendance manage, leave approve
- Payroll: compensation view/manage, payroll prepare/review/approve/finalize, payslip view
- Inventory: product view/manage, stock view/adjust/approve, purchase manage
- Collections: receivable view/manage, payment record/reconcile, credit override, write-off approve, collection communication

Existing Business Owner remains the only default role that should receive all new capabilities. New granular roles must be explicitly assigned; legacy `admin`/`manager` roles should not receive salary, payroll, payment-reversal, or write-off permissions by default.

## Delivery order

1. Reconcile migrations and define shared money/ledger conventions.
2. Add HR core schema and secure employee/department APIs.
3. Add attendance and leave with approval workflow.
4. Add payroll rulesets/runs only after money and approval controls are tested.
5. Add inventory products, locations, and movement ledger.
6. Add suppliers, purchasing, transfers, counts, and reservations.
7. Add receivables, invoices integration, payments, allocations, and aging.
8. Add collections policies, workspace, and controlled Collections AI tools.
9. Add cross-module events, reports, and executive analytics.

## Non-negotiable controls

- All domain queries require active authorized business context.
- Financial values use integer minor units; no floating-point calculations.
- Finalized payroll, payments, inventory movements, and write-offs are append-only/auditable.
- Sensitive operations require server-side permissions and, where configured, approvals.
- AI tools never bypass authorization, policy, or approval checks.
- Secure documents use authenticated access; no public employee-document URLs.
