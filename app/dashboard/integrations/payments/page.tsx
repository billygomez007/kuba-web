"use client";

export default function PaymentsIntegrationPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-black">Payments</h1>

        <p className="mt-3 text-white/50">
          Business payment collection is not connected in this environment.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
            <p className="font-semibold text-amber-200">Status: Not Configured</p>
            <p className="mt-2 text-sm text-amber-100/70">
              No Stripe or Paystack merchant account can be connected for customer payments yet.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-amber-100/70">
              <li>• No merchant connection flow or business payment credential storage exists.</li>
              <li>• No payment link, invoice, charge, refund, or payment-status API exists.</li>
              <li>• No payment webhook currently maps customer payment events to a business.</li>
            </ul>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {["Stripe", "Paystack"].map((provider) => (
              <div key={provider} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="font-semibold">{provider}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-wide text-cyan-200/70">Platform Billing Only</p>
                <p className="mt-2 text-sm text-white/50">
                  Used for SuperKuba subscription checkout and billing state, not customer payment collection for your business.
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <p className="font-semibold text-white">Staging safety</p>
            <p className="mt-2 text-sm text-white/60">
              This page has no payment action controls and does not process real money. Sandbox merchant support will remain disabled until a tenant-scoped implementation is available.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100/75">
          Customer payment collection, payment links, refunds, and Collections Agent support are Coming Soon.
        </div>
      </div>
    </main>
  );
}
