"use client";

import IntegrationStatusPage from "../IntegrationStatusPage";

export default function AccountingIntegrationPage() {
  return <IntegrationStatusPage title="Accounting" description="Connect a business accounting system to synchronize authoritative financial records with Kuba." providers={["QuickBooks Online", "Xero", "Sage", "Zoho Books"]} status="Coming Soon" notes={["No external accounting OAuth, ledger, invoice sync, expense sync, or reconciliation service exists.", "Subscription billing, payroll, sales records, and analytics remain separate domains.", "A future connector will require tenant-bound OAuth, encrypted tokens, provider webhooks, sync ownership, and accounting permissions."]} />;
}
