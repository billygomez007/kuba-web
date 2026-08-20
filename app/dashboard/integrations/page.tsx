"use client";

import { useEffect, useState } from "react";

import {
  FaWhatsapp,
  FaFacebook,
  FaInstagram,
  FaTelegram,
  FaEnvelope,
  FaGlobe,
} from "react-icons/fa";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<any[]>([]);

  async function loadIntegrations() {
    const res = await fetch("/api/integrations", {
      cache: "no-store",
    });

    const data = await res.json();

    setIntegrations(
      data.integrations || [],
    );
  }

  useEffect(() => {
    loadIntegrations();
  }, []);

  const items = [
    {
      name: "WhatsApp",
      provider: "whatsapp",
      description:
        "Connect WhatsApp so Kuba can communicate with customers.",
      icon: <FaWhatsapp size={40} />,
    },
    {
      name: "Email",
      provider: "email",
      description:
        "Connect business email communication.",
      icon: <FaEnvelope size={40} />,
    },
    {
      name: "Website Chat",
      provider: "website",
      description:
        "Add Kuba chat to your website.",
      icon: <FaGlobe size={40} />,
    },
    {
      name: "Facebook & Instagram",
      provider: "meta",
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
      description:
        "Connect Telegram for customer conversations.",
      icon: <FaTelegram size={40} />,
    },
  ];

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <h1 className="text-4xl font-black">
        Integrations
      </h1>

      <p className="mt-3 text-white/50">
        Connect Kuba with your business channels.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-2">

        {items.map((item) => {
          const connected = integrations.some(
            (integration) =>
              integration.provider === item.provider &&
              integration.status === "active",
          );

          return (
            <div
              key={item.provider}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >
              <div className="text-white">
                {item.icon}
              </div>

              <h2 className="mt-4 text-xl font-bold">
                {item.name}
              </h2>

              <p className="mt-2 text-sm text-white/50">
                {item.description}
              </p>

              <div className="mt-5 flex items-center justify-between">

                <span className="text-xs uppercase text-white/40">
                  {connected
                    ? "Connected"
                    : "Not connected"}
                </span>

                <button
                  onClick={() => {
                    if (item.provider === "whatsapp") {
                      window.location.href =
                        "/dashboard/integrations/whatsapp";
                    }

                    if (item.provider === "website") {
                      window.location.href =
                        "/dashboard/integrations/website-chat";
                    }

                    if (item.provider === "meta") {
                      window.location.href =
                        "/dashboard/integrations/meta";
                    }

                    if (item.provider === "telegram") {
                      window.location.href =
                        "/dashboard/integrations/telegram";
                    }

                    if (item.provider === "email") {
                      window.location.href =
                        "/dashboard/integrations/email";
                    }
                  }}
                  className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black"
                >
                  {connected ? "Manage" : "Connect"}
                </button>

              </div>

            </div>
          );
        })}

      </div>

    </main>
  );
}
