"use client";

import { useEffect, useState } from "react";

type WebsiteChatIntegration = {
  id: string;
  publicKey: string | null;
  status: string;
};

export default function WebsiteChatClient() {
  const [integration, setIntegration] =
    useState<WebsiteChatIntegration | null>(
      null,
    );
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] =
    useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadIntegration() {
      try {
        const response = await fetch(
          "/api/integrations/website-chat",
        );
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load Website Chat.",
          );
        }

        setIntegration(data.integration ?? null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load Website Chat.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadIntegration();
  }, []);

  const publicKey =
    integration?.status === "active"
      ? integration.publicKey
      : null;
  const code = publicKey
    ? `<script src="https://superkuba.com/kuba/chat.js" data-public-key="${publicKey}"></script>`
    : "";

  async function activateIntegration() {
    setActivating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        "/api/integrations/website-chat",
        {
          method: "PUT",
        },
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Unable to activate Website Chat.",
        );
      }

      setIntegration(data.integration);
      setSuccess(
        data.activated
          ? "Website Chat is active and ready to install."
          : "Website Chat is already active.",
      );
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Unable to activate Website Chat.",
      );
    } finally {
      setActivating(false);
    }
  }

  async function copyCode() {
    setError("");

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setSuccess(
        "Embed code copied to your clipboard.",
      );
      window.setTimeout(
        () => setCopied(false),
        2000,
      );
    } catch {
      setError(
        "Unable to copy automatically. Select and copy the embed code manually.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <h1 className="text-3xl font-black">
          Website Chat Integration
        </h1>

        <p className="mt-3 text-white/50">
          Activate Website Chat, then copy the
          embed code before the closing body tag
          of your website.
        </p>

        {loading ? (
          <p
            className="mt-8 text-sm text-white/60"
            role="status"
          >
            Loading Website Chat status...
          </p>
        ) : publicKey ? (
          <>
            <div className="mt-8 overflow-auto rounded-2xl bg-black/40 p-5">
              <code className="text-sm text-cyan-300">
                {code}
              </code>
            </div>

            <button
              type="button"
              onClick={copyCode}
              className="mt-5 rounded-xl bg-white px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {copied
                ? "Copied"
                : "Copy Embed Code"}
            </button>
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-5">
            <p className="font-semibold">
              Website Chat is not active.
            </p>
            <p className="mt-2 text-sm text-white/60">
              Activation creates a tenant-specific
              public key. No private credentials are
              stored in your browser.
            </p>
            <button
              type="button"
              onClick={activateIntegration}
              disabled={activating}
              className="mt-5 rounded-xl bg-cyan-300 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activating
                ? "Activating..."
                : "Activate Website Chat"}
            </button>
          </div>
        )}

        {error ? (
          <p
            className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
            role="status"
          >
            {success}
          </p>
        ) : null}

      </div>

    </main>
  );
}
