"use client";

export default function AccountingIntegrationPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-black">Accounting</h1>

        <p className="mt-3 text-white/50">
          Connect a business accounting system to synchronize authoritative financial records with Kuba.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
            <p className="font-semibold text-amber-200">Status: Coming Soon</p>
            <p className="mt-2 text-sm text-amber-100/70">
              No external accounting connector is operational in this environment. No provider is connected and there are no accounting actions available.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amber-100/70">
              <li>• QuickBooks Online</li>
              <li>• Xero</li>
              <li>• Sage</li>
              <li>• Zoho Books</li>
            </ul>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-semibold text-white">What this does not represent</p>
            <ul className="mt-3 space-y-2 text-sm text-white/60">
              <li>• SuperKuba subscription billing remains under Settings → Billing & Subscription.</li>
              <li>• Payroll remains under Human Workforce → Payroll.</li>
              <li>• Sales, leads, and financial analytics are operational records, not an accounting ledger.</li>
            </ul>
          </div>

          <div className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100/75">
            A future connector will require tenant-bound OAuth, encrypted token storage, provider webhooks, sync ownership, and explicit accounting permissions before it can expose financial data.
          </div>
        </div>

        <p className="mt-8 text-xs uppercase tracking-[0.16em] text-white/30">No connection controls are available until a real connector is implemented.</p>
      </div>
    </main>
  );
}
