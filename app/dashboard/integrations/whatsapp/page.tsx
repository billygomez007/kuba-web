"use client";

import { useEffect, useState } from "react";

type WhatsAppIntegration = {
  id: string;
  provider: string;
  status: string;
  externalAccountId: string | null;
  externalPhoneNumberId: string | null;
  displayName: string | null;
  lastWebhookAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export default function WhatsAppIntegrationPage() {
  const [integration, setIntegration] =
    useState<WhatsAppIntegration | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [disconnecting, setDisconnecting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function loadIntegration() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch("/api/integrations");

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load integrations.",
        );
      }

      const whatsapp =
        data.integrations?.find(
          (item: WhatsAppIntegration) =>
            item.provider === "whatsapp",
        );

      setIntegration(
        whatsapp || null,
      );
    } catch (err) {
      console.error(
        "WhatsApp integration loading error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load WhatsApp integration.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadIntegration();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  async function connect(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const formData =
        new FormData(event.currentTarget);

      const response =
        await fetch(
          "/api/integrations/whatsapp",
          {
            method: "POST",
            body: formData,
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to connect WhatsApp.",
        );
      }

      setMessage(
        "WhatsApp connected successfully.",
      );

      event.currentTarget.reset();

      await loadIntegration();
    } catch (err) {
      console.error(
        "WhatsApp connection error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect WhatsApp.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    const confirmed =
      window.confirm(
        "Disconnect WhatsApp from this business?",
      );

    if (!confirmed) {
      return;
    }

    setDisconnecting(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/integrations/whatsapp",
          {
            method: "DELETE",
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to disconnect WhatsApp.",
        );
      }

      setIntegration(null);

      setMessage(
        "WhatsApp has been disconnected.",
      );
    } catch (err) {
      console.error(
        "WhatsApp disconnect error:",
        err,
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to disconnect WhatsApp.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl">

        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Integrations
          </p>

          <h1 className="mt-2 text-3xl font-black">
            WhatsApp
          </h1>

          <p className="mt-3 max-w-2xl text-white/50">
            Connect WhatsApp Business so Kuba can
            receive customer messages, route
            conversations, and respond through the
            appropriate AI employee.
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">
            <p className="text-white/50">
              Checking WhatsApp connection...
            </p>
          </div>
        ) : integration ? (
          <div className="space-y-6">

            <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.06] p-8">

              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-xl">
                      ✓
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        WhatsApp Connected
                      </h2>

                      <p className="mt-1 text-sm text-emerald-300/70">
                        Kuba can use this WhatsApp integration.
                      </p>
                    </div>
                  </div>
                </div>

                <span className="w-fit rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-300">
                  {integration.status}
                </span>

              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    WhatsApp Business ID
                  </p>

                  <p className="mt-2 break-all font-mono text-sm text-white/80">
                    {integration.externalAccountId ||
                      "Not available"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Phone Number ID
                  </p>

                  <p className="mt-2 break-all font-mono text-sm text-white/80">
                    {integration.externalPhoneNumberId ||
                      "Not available"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-white/40">
                    Last Webhook Received
                  </p>

                  <p className="mt-2 text-sm text-white/80">
                    {integration.lastWebhookAt
                      ? new Date(integration.lastWebhookAt).toLocaleString()
                      : "No webhook received yet"}
                  </p>
                </div>

              </div>

              <div className="mt-6 flex flex-wrap gap-3">

                <button
                  type="button"
                  onClick={() => {
                    setMessage("");
                    setError("");
                    setIntegration(null);
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-white hover:bg-white/10"
                >
                  Reconnect
                </button>

                <button
                  type="button"
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                >
                  {disconnecting
                    ? "Disconnecting..."
                    : "Disconnect"}
                </button>

              </div>

            </section>

          </div>
        ) : (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-8">

            <div className="mb-8">
              <h2 className="text-xl font-bold">
                Connect WhatsApp Business
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/50">
                Enter your Meta WhatsApp Business
                credentials. Your access token is
                encrypted before it is stored.
              </p>
            </div>

            <form
              onSubmit={connect}
              className="space-y-5"
            >

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  WhatsApp Business ID
                </label>

                <input
                  name="businessId"
                  required
                  placeholder="Enter WhatsApp Business ID"
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none transition focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  Phone Number ID
                </label>

                <input
                  name="phoneNumberId"
                  required
                  placeholder="Enter Phone Number ID"
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none transition focus:border-cyan-400/50"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/70">
                  Access Token
                </label>

                <input
                  name="accessToken"
                  type="password"
                  required
                  placeholder="Enter WhatsApp access token"
                  className="w-full rounded-xl border border-white/10 bg-black/30 p-4 outline-none transition focus:border-cyan-400/50"
                />

                <p className="mt-2 text-xs text-white/35">
                  Kuba will never display the stored
                  access token.
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-white px-7 py-3.5 font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Connecting..."
                  : "Connect WhatsApp"}
              </button>

            </form>

          </section>
        )}

        {message && (
          <div className="mt-5 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-300">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/30">
            Security
          </p>

          <p className="mt-2 text-sm leading-6 text-white/45">
            WhatsApp credentials are stored per business.
            Kuba does not expose the access token through
            the dashboard or integrations API.
          </p>
        </div>

      </div>
    </main>
  );
}
