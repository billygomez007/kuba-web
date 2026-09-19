"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

type Status = {
  connected: boolean;
  verifiedAt?: string | null;
  lastDeliveryStatus?: number | null;
  apiKeyProtected?: boolean;
};

export default function MakeIntegrationPage() {
  const [
    status,
    setStatus,
  ] =
    useState<Status>({
      connected: false,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function load() {
    try {
      const response =
        await fetch(
          "/api/integrations/make/status",
          {
            cache:
              "no-store",
          },
        );

      const body =
        await response.json();

      if (response.ok) {
        setStatus(
          body,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function connect(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    const form =
      new FormData(
        event.currentTarget,
      );

    try {
      const response =
        await fetch(
          "/api/integrations/make/connect",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                webhookUrl:
                  form.get(
                    "webhookUrl",
                  ),
                apiKey:
                  form.get(
                    "apiKey",
                  ),
              }),
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Unable to connect Make.",
        );
      }

      setMessage(
        "Make connected and verified.",
      );

      event.currentTarget.reset();

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to connect Make.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function testDelivery() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/integrations/make/test",
          {
            method: "POST",
          },
        );

      const body =
        await response.json();

      if (!response.ok) {
        throw new Error(
          body.error ||
            "Test delivery failed.",
        );
      }

      setMessage(
        "Test event delivered to Make.",
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Test delivery failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response =
        await fetch(
          "/api/integrations/make/disconnect",
          {
            method: "POST",
          },
        );

      if (!response.ok) {
        throw new Error(
          "Unable to disconnect Make.",
        );
      }

      setMessage(
        "Make disconnected.",
      );

      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to disconnect Make.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/integrations/external-apps"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← External apps
        </Link>

        <h1 className="mt-5 text-3xl font-black">
          Make
        </h1>

        <p className="mt-3 text-white/50">
          Connect a Make Custom Webhook so
          SuperKuba can send approved
          business events into your Make
          scenarios.
        </p>

        {message && (
          <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4 text-sm text-emerald-200">
            {message}
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading &&
        status.connected ? (
          <section className="mt-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.04] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
              Connected
            </p>

            <h2 className="mt-3 text-xl font-bold">
              Make Custom Webhook
            </h2>

            <p className="mt-2 text-sm text-white/50">
              API key protection:{" "}
              {status.apiKeyProtected
                ? "Enabled"
                : "Not configured"}
            </p>

            <p className="mt-2 text-sm text-white/50">
              Delivery status:{" "}
              {status.lastDeliveryStatus ||
                "Verified"}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void testDelivery()
                }
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
              >
                Send test event
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void disconnect()
                }
                className="rounded-xl border border-red-300/20 px-5 py-3 text-sm font-bold text-red-200 disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          </section>
        ) : (
          <form
            onSubmit={connect}
            className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <label className="block">
              <span className="text-sm font-semibold">
                Make Custom Webhook URL
              </span>

              <input
                name="webhookUrl"
                type="url"
                required
                placeholder="https://hook.us1.make.com/..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold">
                Make webhook API key
                <span className="ml-2 text-white/35">
                  Optional
                </span>
              </span>

              <input
                name="apiKey"
                type="password"
                autoComplete="new-password"
                placeholder="Optional x-make-apikey value"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <p className="text-xs leading-5 text-white/35">
              In Make, create Webhooks →
              Custom webhook and paste the
              generated URL here. If you
              configured API-key protection,
              enter the same key above.
            </p>

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black disabled:opacity-50"
            >
              {saving
                ? "Verifying…"
                : "Connect Make"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
