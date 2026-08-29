import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Security | SuperKuba",
  description: "How SuperKuba isolates tenant data, verifies webhooks, and handles payment and access security.",
  alternates: { canonical: "/security" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-white/60">{children}</div>
    </section>
  );
}

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <MarketingHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Security</h1>
        <p className="mt-4 text-sm text-white/40">Last updated: 2026-08-29. This page describes SuperKuba&apos;s current security architecture. SuperKuba does not hold third-party security certifications (such as SOC 2 or ISO 27001) at this time.</p>

        <Section title="Tenant isolation">
          <p>
            Every business&apos;s data is scoped by business ID at the database and application layers. Team members only access the business they are currently signed into, and requests that attempt to reference another business&apos;s records are rejected rather than silently redirected.
          </p>
        </Section>

        <Section title="Role-based access control">
          <p>
            Access within a business is controlled by roles and permissions (for example, owner, admin, and staff roles) that are checked independently of your subscription plan. Plan entitlements and RBAC permissions are enforced separately, so upgrading a plan does not itself grant a role a capability it was not already permitted to use.
          </p>
        </Section>

        <Section title="AI employee authority">
          <p>
            AI employees always operate within the business context of the account that configured them — an AI employee cannot read or act on another business&apos;s data. Sensitive customer-communication actions requested by an AI employee are queued for a human with approval authority to review before anything is sent to a real customer.
          </p>
        </Section>

        <Section title="Webhook and provider security">
          <p>
            Inbound webhooks from connected providers (including WhatsApp/Meta, Stripe, and Paystack) are verified using each provider&apos;s signature scheme before their content is trusted or processed. Connected-channel credentials (such as WhatsApp access tokens) are encrypted before storage.
          </p>
        </Section>

        <Section title="Payments">
          <p>
            Subscription payments are processed by Stripe or Paystack through their hosted checkout pages. SuperKuba does not receive, process, or store raw card numbers, CVV codes, or full payment credentials.
          </p>
        </Section>

        <Section title="Auditability">
          <p>
            Sensitive actions — including team role changes, business profile updates, billing changes, and approved communication actions — are recorded in an internal audit log tied to the business and, where applicable, the user who performed the action.
          </p>
        </Section>

        <Section title="Reporting a security issue">
          <p>
            If you believe you have found a security vulnerability in SuperKuba, please contact us through the Contact Sales form and describe the issue in detail. We will acknowledge reports and follow up as we investigate.
          </p>
        </Section>
      </div>

      <MarketingFooter />
    </main>
  );
}
