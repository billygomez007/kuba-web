"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  FaWhatsapp,
  FaFacebook,
  FaInstagram,
  FaTelegram,
  FaEnvelope,
  FaGlobe,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

type IntegrationRecord = {
  id: string;
  provider: string;
  status?: string;
  displayName?: string | null;
  externalAccountId?: string | null;
  createdAt?: number;
};

type IntegrationsOverview = {
  integrations: IntegrationRecord[];
  stats: {
    connected: number;
    total: number;
    lastUpdated: string;
  };
};

export default function IntegrationsPage() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<IntegrationRecord[]>([]);
  const [stats, setStats] = useState({ connected: 0, total: 0, lastUpdated: new Date().toISOString() });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const res = await fetch("/api/integrations", {
          cache: "no-store",
        });

        const data = (await res.json()) as IntegrationsOverview;
        setIntegrations(data.integrations || []);
        setStats(data.stats || { connected: 0, total: 0, lastUpdated: new Date().toISOString() });
      } catch (err) {
        console.error("Failed to load integrations:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadIntegrations();
  }, []);

  const items = [
    {
      name: "WhatsApp",
      provider: "whatsapp",
      category: "Communication Channels",
      description:
        "Connect WhatsApp so Kuba can communicate with customers.",
      icon: <FaWhatsapp size={40} />,
    },
    {
      name: "Email",
      provider: "email",
      category: "Communication Channels",
      description:
        "Connect business email communication.",
      icon: <FaEnvelope size={40} />,
    },
    {
      name: "Website Chat",
      provider: "website_chat",
      category: "Communication Channels",
      description:
        "Add Kuba chat to your website.",
      icon: <FaGlobe size={40} />,
    },
    {
      name: "SMS",
      provider: "sms",
      category: "Communication Channels",
      description:
        "Connect SMS for customer messaging.",
      icon: <FaEnvelope size={40} />,
      status: "coming-soon",
    },
    {
      name: "Voice",
      provider: "voice",
      category: "Communication Channels",
      description:
        "Connect and manage AI voice calling providers and phone numbers.",
      icon: <FaGlobe size={40} />,
    },
    {
      name: "Facebook & Instagram",
      provider: "meta",
      category: "Social Channels",
      description:
        "Manage social conversations.",
      icon:
        <div className="flex gap-2">
          <FaFacebook size={40} />
          <FaInstagram size={40} />
        </div>,
      status: "coming-soon",
    },
    {
      name: "Telegram",
      provider: "telegram",
      category: "Social Channels",
      description:
        "Connect Telegram for customer conversations.",
      icon: <FaTelegram size={40} />,
      status: "coming-soon",
    },
  ];

  const commChannels = items.filter(i => i.category === "Communication Channels");
  const socialChannels = items.filter(i => i.category === "Social Channels");
  const providerSections = [
    {
      title: "Calendar",
      providers: [
        { name: "Google Calendar", href: "/dashboard/integrations/calendar" },
        { name: "Microsoft Outlook Calendar", href: "/dashboard/integrations/calendar" },
        { name: "Apple Calendar", href: "/dashboard/integrations/apple-calendar" },
      ],
    },
    {
      title: "Payments & Accounting",
      providers: [
        { name: "Paystack", href: "/dashboard/integrations/payments" },
        { name: "QuickBooks Online", href: "/dashboard/integrations/accounting" },
      ],
    },
    {
      title: "CRM",
      providers: [
        { name: "Salesforce", href: "/dashboard/integrations/crm" },
        { name: "HubSpot", href: "/dashboard/integrations/crm" },
        { name: "Pipedrive", href: "/dashboard/integrations/crm" },
        { name: "Zoho CRM", href: "/dashboard/integrations/crm" },
        { name: "Microsoft Dynamics 365", href: "/dashboard/integrations/microsoft-dynamics" },
      ],
    },
    {
      title: "Business Apps",
      providers: [
        { name: "Slack", href: "/dashboard/integrations/external-apps" },
        { name: "Microsoft Teams", href: "/dashboard/integrations/external-apps" },
        { name: "Notion", href: "/dashboard/integrations/external-apps" },
        { name: "Google Drive", href: "/dashboard/integrations/external-apps" },
        { name: "Dropbox", href: "/dashboard/integrations/external-apps" },
      ],
    },
    {
      title: "Automation",
      providers: [
        { name: "Zapier", href: "/dashboard/integrations/zapier" },
        { name: "Make", href: "/dashboard/integrations/make" },
      ],
    },
  ];

  const getIntegrationStatus = (provider: string) => {
    const integration = integrations.find((i) => i.provider === provider);
    const isActive = integration?.status === "active";
    const isWebsiteConfigured = provider === "website_chat" && isActive;
    const isWhatsAppConfigured = provider === "whatsapp" && isActive;
    const isEmailConfigured = provider === "email" && isActive;

    return {
      connected: isWhatsAppConfigured || isWebsiteConfigured || isEmailConfigured,
      integration,
    };
  };

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mb-10">
        <h1 className="text-4xl font-black">Integrations</h1>
        <p className="mt-3 text-white/50">
          Connect Kuba with your business channels and external services.
        </p>
      </div>

      {/* Stats Overview */}
      <div className="mb-10 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-sm text-white/60">Connected</div>
          <div className="mt-2 text-3xl font-bold">{stats.connected}</div>
          <div className="mt-1 text-xs text-white/40">of {stats.total} integrations</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-sm text-white/60">Status</div>
          <div className="mt-2 text-lg font-semibold text-green-400">Active</div>
          <div className="mt-1 text-xs text-white/40">Last updated now</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="text-sm text-white/60">Setup Required</div>
          <div className="mt-2 text-3xl font-bold">{stats.total - stats.connected}</div>
          <div className="mt-1 text-xs text-white/40">Not yet configured</div>
        </div>
      </div>

      {/* Communication Channels */}
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Communication Channels</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {commChannels.map((item) => {
            const { connected, integration } = getIntegrationStatus(item.provider);
            const isComingSoon = item.status === "coming-soon";

            return (
              <div
                key={item.provider}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="text-white">{item.icon}</div>
                  {connected && <FaCheckCircle className="text-green-400" size={24} />}
                  {!connected && !isComingSoon && <FaTimesCircle className="text-white/40" size={24} />}
                </div>

                <h3 className="mt-4 text-xl font-bold">{item.name}</h3>

                <p className="mt-2 text-sm text-white/50">{item.description}</p>

                {integration && (
                  <div className="mt-3 text-xs text-white/40">
                    <div>Account: {integration.displayName || integration.externalAccountId || "Configured"}</div>
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs uppercase text-white/40">
                    {connected ? "Connected" : isComingSoon ? "Coming Soon" : "Configuration Required"}
                  </span>

                  {!isComingSoon && (
                    <button
                      onClick={() => {
                        const routeMap: Record<string, string> = {
                          whatsapp: "/dashboard/integrations/whatsapp",
                          website_chat: "/dashboard/integrations/website-chat",
                          meta: "/dashboard/integrations/meta",
                          telegram: "/dashboard/integrations/telegram",
                          email: "/dashboard/integrations/email",
                          sms: "/dashboard/integrations/sms",
                          voice: "/dashboard/integrations/voice",
                        };

                        const nextRoute = routeMap[item.provider];
                        if (nextRoute) {
                          router.push(nextRoute);
                        }
                      }}
                      className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                    >
                      {connected ? "Manage" : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Social Channels */}
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Social Channels</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {socialChannels.map((item) => {
            const { connected } = getIntegrationStatus(item.provider);
            const isComingSoon = item.status === "coming-soon";

            return (
              <div
                key={item.provider}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="text-white">{item.icon}</div>
                  {connected && <FaCheckCircle className="text-green-400" size={24} />}
                  {!connected && !isComingSoon && <FaTimesCircle className="text-white/40" size={24} />}
                </div>

                <h3 className="mt-4 text-xl font-bold">{item.name}</h3>

                <p className="mt-2 text-sm text-white/50">{item.description}</p>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs uppercase text-white/40">
                    {isComingSoon ? "Coming Soon" : connected ? "Connected" : "Not connected"}
                  </span>

                  {!isComingSoon && (
                    <button
                      onClick={() => {
                        const routeMap: Record<string, string> = {
                          meta: "/dashboard/integrations/meta",
                          telegram: "/dashboard/integrations/telegram",
                        };

                        const nextRoute = routeMap[item.provider];
                        if (nextRoute) {
                          router.push(nextRoute);
                        }
                      }}
                      className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black transition-opacity hover:opacity-90"
                    >
                      {connected ? "Manage" : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Provider integrations */}
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Business Integrations</h2>

        <div className="space-y-8">
          {providerSections.map((section) => (
            <section key={section.title}>
              <h3 className="mb-4 text-lg font-semibold text-white/80">
                {section.title}
              </h3>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {section.providers.map((provider) => (
                  <Link
                    key={provider.name}
                    href={provider.href}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-cyan-300/25 hover:bg-white/[0.06]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="font-semibold">{provider.name}</h4>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-cyan-200/70">
                        Available
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-white/45">
                      Open integration settings
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
