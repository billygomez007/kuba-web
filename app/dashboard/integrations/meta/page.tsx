"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Integration = {
  id: string;
  status: string;
  externalAccountId: string | null;
  displayName: string | null;
  metadata: {
    channel?: string;
    pageName?: string;
    instagramUsername?: string;
  } | null;
  lastWebhookAt: string | null;
};

export default function MetaIntegrationPage() {
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] =
    useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        "/api/integrations/meta",
        { cache: "no-store" },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Unable to load Meta integrations.",
        );
      }

      setItems(body.integrations || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load Meta integrations.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(
    channel: "facebook_messenger" | "instagram",
  ) {
    setConnecting(channel);
    setError("");

    try {
      const response = await fetch(
        "/api/integrations/meta/connect",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel }),
        },
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Unable to start Meta connection.",
        );
      }

      window.location.href =
        body.authorizationUrl;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to start Meta connection.",
      );
      setConnecting(null);
    }
  }

  const facebook = items.find(
    (item) =>
      item.metadata?.channel ===
      "facebook_messenger",
  );

  const instagram = items.find(
    (item) =>
      item.metadata?.channel === "instagram",
  );

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard/integrations"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← Integrations
        </Link>

        <h1 className="mt-5 text-4xl font-black">
          Facebook & Instagram
        </h1>

        <p className="mt-3 max-w-2xl text-white/50">
          Connect Facebook Pages and Instagram
          Professional accounts to SuperKuba so
          Messenger and Instagram conversations can
          appear in the Unified Inbox.
        </p>

        {error && (
          <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">
            {error}
          </p>
        )}

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <ChannelCard
            title="Facebook Messenger"
            description="Connect a Facebook Page and receive Messenger conversations in SuperKuba."
            integration={facebook}
            loading={loading}
            connecting={
              connecting === "facebook_messenger"
            }
            onConnect={() =>
              void connect("facebook_messenger")
            }
          />

          <ChannelCard
            title="Instagram"
            description="Connect an Instagram Professional account and manage customer conversations from SuperKuba."
            integration={instagram}
            loading={loading}
            connecting={
              connecting === "instagram"
            }
            onConnect={() =>
              void connect("instagram")
            }
          />
        </div>
      </div>
    </main>
  );
}

function ChannelCard({
  title,
  description,
  integration,
  loading,
  connecting,
  onConnect,
}: {
  title: string;
  description: string;
  integration?: Integration;
  loading: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  const connected =
    integration?.status === "active";
  const pending =
    integration?.status === "pending";

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-white/45">
            {description}
          </p>
        </div>

        <span
          className={
            connected
              ? "rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300"
              : "rounded-full bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/40"
          }
        >
          {loading
            ? "Checking"
            : connected
              ? "Connected"
              : pending
                ? "Discovered"
                : "Not connected"}
        </span>
      </div>

      {integration && (
        <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-sm">
          <p className="font-semibold">
            {integration.displayName ||
              integration.externalAccountId ||
              "Meta account"}
          </p>
          <p className="mt-1 text-xs text-white/35">
            Last webhook:{" "}
            {integration.lastWebhookAt ||
              "Not received yet"}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={onConnect}
        disabled={connecting || connected || pending}
        className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {connected
          ? "Connected"
          : pending
            ? "Awaiting webhook verification"
            : connecting
              ? "Opening Meta..."
              : `Connect ${title}`}
      </button>
    </section>
  );
}
