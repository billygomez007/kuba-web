import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";

export const metadata: Metadata = {
  title: "Privacy Policy | SuperKuba",
  description: "How SuperKuba collects, uses, and protects information for businesses and their customers.",
  alternates: { canonical: "/privacy" },
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-white/60">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <MarketingHeader />

      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300">Legal</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Privacy Policy</h1>
        <p className="mt-4 text-sm text-white/40">Last updated: 2026-08-29. This page describes SuperKuba&apos;s current data practices and is subject to final legal review before it is treated as a binding legal document.</p>

        <Section title="Who this policy covers">
          <p>
            This policy applies to SuperKuba (&ldquo;SuperKuba,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) and the SuperKuba platform at superkuba.com. It covers the business accounts that use SuperKuba (&ldquo;business customers&rdquo;) and the end customers those businesses interact with through SuperKuba (&ldquo;end customers&rdquo;).
          </p>
        </Section>

        <Section title="Information we collect">
          <p><strong>Business account information:</strong> name, email address, password (stored by our authentication provider, never in plain text), business profile details you provide (business name, industry, country, description, products, target customers), and team membership/role information.</p>
          <p><strong>Business operational data:</strong> records your business creates or receives while using SuperKuba, including customers, leads, conversations, messages, appointments, tickets, tasks, and files you upload to Business Brain knowledge sources.</p>
          <p><strong>Communication content:</strong> messages exchanged between your business, your AI employees, and your end customers through connected channels (such as WhatsApp or website chat), so that conversations can be displayed in your Unified Inbox and used to generate AI responses.</p>
          <p><strong>Usage and session data:</strong> authentication session identifiers, basic device/browser information, and application logs needed to operate and secure the platform.</p>
        </Section>

        <Section title="Business account information vs. end customer data">
          <p>
            Your business is the data controller for the customer and operational data you and your end customers generate inside SuperKuba. SuperKuba processes that data on your behalf to provide the platform. If your business needs a data processing agreement, contact us through the Contact Sales form.
          </p>
        </Section>

        <Section title="Payment information and provider separation">
          <p>
            SuperKuba subscription billing is handled by Stripe or Paystack, depending on how your account is configured. Card and payment details are entered directly with that provider through a hosted checkout page — SuperKuba does not receive or store your raw card number, CVV, or full payment credentials. SuperKuba stores only the subscription status, plan, and provider references needed to manage your account.
          </p>
        </Section>

        <Section title="Cookies and session data">
          <p>
            SuperKuba uses a session cookie to keep you signed in and a selected-business cookie to remember which business you are currently working in. We do not currently use third-party advertising or cross-site tracking cookies on the authenticated application.
          </p>
        </Section>

        <Section title="How AI processes your data">
          <p>
            AI employees you configure use the business information, knowledge, and conversation history you provide to generate responses and, where you have explicitly enabled it, to take specific actions within your SuperKuba workspace. AI-generated actions are scoped to your business and, for sensitive actions, may require human approval before anything is sent to a real customer. We do not use your business data to train AI models for other customers.
          </p>
        </Section>

        <Section title="Data security">
          <p>
            We apply tenant isolation so that one business cannot access another business&apos;s data, role-based access control for team members, encrypted storage for connected-channel credentials, and signature verification on inbound provider webhooks. No method of storage or transmission is completely secure, and we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            We retain business account and operational data for as long as your account is active. If you close your account, we retain data only as needed to comply with legal obligations, resolve disputes, and enforce our agreements, after which it is deleted or anonymized. Specific retention periods per data category are subject to final legal review.
          </p>
        </Section>

        <Section title="Your rights and how to contact us">
          <p>
            Depending on your location, you may have rights to access, correct, export, or delete your personal information. To make a request, or with any privacy question, use the Contact Sales form or email us at the address associated with your account confirmation emails.
          </p>
        </Section>

        <Section title="Third-party service providers">
          <p>
            We use a small number of infrastructure and communication providers to operate SuperKuba, including our database and hosting provider, our authentication provider, our transactional email provider, our billing providers (Stripe and/or Paystack), and messaging channel providers (such as Meta&apos;s WhatsApp Cloud API) you choose to connect. These providers process data only as needed to provide their service to SuperKuba.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy as SuperKuba&apos;s features change. Material changes will be reflected by updating the &ldquo;Last updated&rdquo; date above.
          </p>
        </Section>
      </div>

      <MarketingFooter />
    </main>
  );
}
