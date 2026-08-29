import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Terms of Service | SuperKuba",
  description: "The terms that govern use of the SuperKuba platform.",
  alternates: { canonical: "/terms" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-white/60">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <MarketingHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Terms of Service</h1>
        <p className="mt-4 text-sm text-white/40">Last updated: 2026-08-29. This page is a baseline description of the terms that govern SuperKuba and is subject to final legal review before it is treated as a binding legal document.</p>

        <Section title="Acceptance of these terms">
          <p>
            By creating a SuperKuba account or using SuperKuba on behalf of a business, you agree to these terms on behalf of yourself and, if applicable, the business you represent.
          </p>
        </Section>

        <Section title="Your account and organization responsibilities">
          <p>
            You are responsible for the accuracy of the business information you provide, for maintaining the confidentiality of your account credentials, and for the actions taken by team members you invite into your business workspace. You are responsible for the content of the knowledge, instructions, and data you upload to SuperKuba, and for ensuring you have the right to use and share that content.
          </p>
        </Section>

        <Section title="AI-generated output limitations">
          <p>
            SuperKuba&apos;s AI employees generate responses and, where explicitly configured, may propose or take actions based on the information and instructions your business provides. AI-generated content may be inaccurate or incomplete. You are responsible for reviewing AI-generated communications and actions where SuperKuba gives you that review step, and for confirming that AI behavior configured for your business complies with applicable law and your own policies. SuperKuba does not guarantee that AI output will be error-free.
          </p>
        </Section>

        <Section title="Prohibited use">
          <p>You may not use SuperKuba to:</p>
          <ul className="list-disc space-y-1 pl-6">
            <li>Send unsolicited, deceptive, or unlawful communications to end customers.</li>
            <li>Upload or process data you do not have the right to use.</li>
            <li>Attempt to circumvent tenant isolation, entitlement, or security controls.</li>
            <li>Reverse-engineer, resell, or white-label the platform without a separate written agreement.</li>
            <li>Use the platform in a way that violates applicable law, including data protection and anti-spam law in the jurisdictions where your end customers are located.</li>
          </ul>
        </Section>

        <Section title="Subscription, billing, and trials">
          <p>
            Paid plans are billed through Stripe or Paystack depending on your account&apos;s configured billing provider. Starter, Growth, and Pro plans may start with a 14-day free trial where offered; your subscription is not charged during an active trial, and the first subscription charge occurs on the date disclosed to you at signup unless you cancel before then. Enterprise pricing and terms are negotiated separately and are not part of self-serve checkout.
          </p>
        </Section>

        <Section title="Cancellation">
          <p>
            You may cancel a self-serve subscription from Settings → Billing. Cancellation takes effect at the end of the current billing period unless stated otherwise at the time of cancellation; SuperKuba does not delete your business data as a result of cancellation or a plan downgrade.
          </p>
        </Section>

        <Section title="Third-party integrations">
          <p>
            SuperKuba integrates with third-party communication and billing providers (for example, Meta&apos;s WhatsApp Cloud API, Stripe, and Paystack). Your use of those providers through SuperKuba is also subject to each provider&apos;s own terms. SuperKuba is not responsible for outages or policy changes made by third-party providers.
          </p>
        </Section>

        <Section title="Service availability">
          <p>
            We aim to keep SuperKuba available and reliable, but we do not currently offer a contractual uptime guarantee or service-level agreement outside of a separately negotiated Enterprise agreement. Scheduled maintenance and unplanned incidents may temporarily affect availability.
          </p>
        </Section>

        <Section title="Data ownership">
          <p>
            As between you and SuperKuba, your business retains ownership of the business and customer data you input into SuperKuba. SuperKuba retains ownership of the platform itself, including its software, AI employee framework, and underlying technology.
          </p>
        </Section>

        <Section title="Suspension and termination">
          <p>
            We may suspend or terminate access to SuperKuba for accounts that violate these terms, present a security risk, or have significantly overdue payment, generally after providing notice where practical. You may stop using SuperKuba and cancel your subscription at any time.
          </p>
        </Section>

        <Section title="Disclaimers and limitation of liability">
          <p>
            SuperKuba is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. To the maximum extent permitted by law, SuperKuba disclaims warranties of merchantability, fitness for a particular purpose, and non-infringement, and SuperKuba&apos;s liability for any claim is limited as described in a final, legally reviewed version of these terms. This section requires final legal review before publication as a binding term.
          </p>
        </Section>

        <Section title="Governing law">
          <p>
            The governing law and jurisdiction for these terms have not yet been finalized. <strong>REQUIRES PRODUCT/LEGAL DECISION.</strong> This section will be completed once that decision is made and reviewed by counsel.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            We may update these terms as SuperKuba&apos;s features change. Material changes will be reflected by updating the &ldquo;Last updated&rdquo; date above.
          </p>
        </Section>
      </div>

      <MarketingFooter />
    </main>
  );
}
