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
      provider: "website",
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
        "Connect phone calls via Twilio.",
      icon: <FaGlobe size={40} />,
      status: "coming-soon",
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
    },
    {
      name: "Telegram",
      provider: "telegram",
      category: "Social Channels",
      description:
        "Connect Telegram for customer conversations.",
      icon: <FaTelegram size={40} />,
    },
  ];

  const commChannels = items.filter(i => i.category === "Communication Channels");
  const socialChannels = items.filter(i => i.category === "Social Channels");
  const remainingIntegrations = [
    { name: "Calendar", href: "/dashboard/integrations/calendar", status: "Coming Soon", description: "Google Calendar, Outlook, and Apple Calendar connections." },
    { name: "Payments", href: "/dashboard/integrations/payments", status: "Platform Billing Only", description: "Business merchant payments are not configured." },
    { name: "Accounting", href: "/dashboard/integrations/accounting", status: "Coming Soon", description: "QuickBooks, Xero, Sage, and other accounting sync." },
    { name: "CRM", href: "/dashboard/integrations/crm", status: "Coming Soon", description: "External CRM contact, lead, and deal synchronization." },
    { name: "External Apps", href: "/dashboard/integrations/external-apps", status: "Coming Soon", description: "Business tool and collaboration connections." },
    { name: "API / Developer Integrations", href: "/dashboard/integrations/developer", status: "Coming Soon", description: "Tenant-safe public API and webhook tooling." },
  ];

  const getIntegrationStatus = (provider: string) => {
    const integration = integrations.find((i) => i.provider === provider);
    const isActive = integration?.status === "active";
    const isTransactionalEmail = provider === "email" && isActive;
    const isWebsiteConfigured = provider === "website" && isActive;
    const isWhatsAppConfigured = provider === "whatsapp" && isActive;

    return {
      connected: isWhatsAppConfigured || isWebsiteConfigured,
      isTransactionalEmail,
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
                    {item.provider === "email" && integration?.status === "active" ? "Transactional only" : item.provider === "email" ? "Not Configured" : connected ? "Connected" : isComingSoon ? "Coming Soon" : "Configuration Required"}
                  </span>

                  {!isComingSoon && (
                    <button
                      onClick={() => {
                        const routeMap: Record<string, string> = {
                          whatsapp: "/dashboard/integrations/whatsapp",
                          website: "/dashboard/integrations/website-chat",
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

            return (
              <div
                key={item.provider}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="text-white">{item.icon}</div>
                  {connected && <FaCheckCircle className="text-green-400" size={24} />}
                  {!connected && <FaTimesCircle className="text-white/40" size={24} />}
                </div>

                <h3 className="mt-4 text-xl font-bold">{item.name}</h3>

                <p className="mt-2 text-sm text-white/50">{item.description}</p>

                <div className="mt-5 flex items-center justify-between">
                  <span className="text-xs uppercase text-white/40">
                    {connected ? "Connected" : "Not connected"}
                  </span>

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
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Remaining integration categories */}
      <div className="mb-12">
        <h2 className="mb-6 text-2xl font-bold">Remaining Integrations</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {remainingIntegrations.map((item) => (
            <Link key={item.name} href={item.href} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{item.name}</h3>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200/70">{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/50">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
