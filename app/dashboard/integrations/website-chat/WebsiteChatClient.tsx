"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type WebsiteChatIntegration = {
  id: string;
  publicKey: string | null;
  status: string;
  domain: string | null;
  welcomeMessage: string | null;
};

type Business = {
  id: string;
  name: string;
};

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function WebsiteChatClient() {
  const [integration, setIntegration] =
    useState<WebsiteChatIntegration | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [aiEmployeeReady, setAiEmployeeReady] = useState(false);

  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [savingDomain, setSavingDomain] = useState(false);
  const [savingWelcome, setSavingWelcome] = useState(false);
  const [testing, setTesting] = useState(false);

  const [domainInput, setDomainInput] = useState("");
  const [welcomeInput, setWelcomeInput] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [testResult, setTestResult] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadIntegration() {
      try {
        const response = await fetch("/api/integrations/website-chat");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load Website Chat.");
        }

        setIntegration(data.integration ?? null);
        setBusiness(data.business ?? null);
        setAiEmployeeReady(Boolean(data.aiEmployeeReady));
        setDomainInput(data.integration?.domain ?? "");
        setWelcomeInput(data.integration?.welcomeMessage ?? "");
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
    integration?.status === "active" ? integration.publicKey : null;

  const code = publicKey
    ? [
        `<script src="https://superkuba.com/kuba/chat.js"`,
        `  data-public-key="${publicKey}"`,
        integration?.welcomeMessage
          ? `  data-welcome="${escapeHtmlAttribute(integration.welcomeMessage)}"`
          : null,
        `></script>`,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  async function activateIntegration() {
    setActivating(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/integrations/website-chat", {
        method: "PUT",
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Unable to activate Website Chat.",
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

  async function saveConfig(
    field: "domain" | "welcomeMessage",
    value: string,
  ) {
    const setSaving = field === "domain" ? setSavingDomain : setSavingWelcome;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/integrations/website-chat", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to save.");
      }

      setIntegration(data.integration);
      setSuccess(
        field === "domain"
          ? "Website saved."
          : "Welcome message saved.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendTestMessage() {
    if (!publicKey) return;

    setTesting(true);
    setError("");
    setTestResult("");

    try {
      const response = await fetch("/api/integrations/website-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicKey,
          message: "This is a test message sent from the SuperKuba dashboard.",
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Test message failed.");
      }

      setTestResult(data.response || "(No response text was returned.)");
    } catch (testError) {
      setError(
        testError instanceof Error ? testError.message : "Test message failed.",
      );
    } finally {
      setTesting(false);
    }
  }

  async function copyCode() {
    setError("");

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setSuccess("Embed code copied to your clipboard.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(
        "Unable to copy automatically. Select and copy the embed code manually.",
      );
    }
  }

  const statusLabel = !integration
    ? "Not configured"
    : integration.status === "active"
      ? "Active"
      : "Configured, not yet active";

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-black">Website Widget</h1>

        <p className="mt-3 text-white/50">
          Add a chat widget to your website so visitors can talk to your AI
          workforce.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-white/60" role="status">
            Loading Website Widget status...
          </p>
        ) : (
          <div className="mt-8 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-white/40">
                  Status
                </p>
                <p className="mt-1 font-semibold">{statusLabel}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-white/40">
                  Business
                </p>
                <p className="mt-1 font-semibold">
                  {business?.name || "—"}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-wider text-white/40">
                AI Employee
              </p>
              {aiEmployeeReady ? (
                <p className="mt-1 font-semibold text-emerald-300">
                  Ready — an active Receptionist will answer visitors.
                </p>
              ) : (
                <>
                  <p className="mt-1 font-semibold text-amber-300">
                    Not ready — no active Receptionist for this business.
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    Visitors will not receive an AI response until a
                    Receptionist is active.
                  </p>
                  <Link
                    href="/dashboard/ai-employees"
                    className="mt-3 inline-flex text-sm font-semibold text-cyan-300/80 hover:text-cyan-300"
                  >
                    Go to AI Employees →
                  </Link>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="text-xs uppercase tracking-wider text-white/40">
                Website
              </label>
              <p className="mt-1 text-sm text-white/50">
                Only this domain will be allowed to use the widget.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(event) => setDomainInput(event.target.value)}
                  placeholder="example.com"
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                />
                <button
                  type="button"
                  onClick={() => saveConfig("domain", domainInput)}
                  disabled={savingDomain}
                  className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDomain ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="text-xs uppercase tracking-wider text-white/40">
                Welcome Message
              </label>
              <p className="mt-1 text-sm text-white/50">
                Shown as the first message when a visitor opens the widget.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={welcomeInput}
                  onChange={(event) => setWelcomeInput(event.target.value)}
                  placeholder="Hi! How can we help you today?"
                  maxLength={300}
                  className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40"
                />
                <button
                  type="button"
                  onClick={() => saveConfig("welcomeMessage", welcomeInput)}
                  disabled={savingWelcome}
                  className="rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingWelcome ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {publicKey ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-wider text-white/40">
                  Installation
                </p>
                <p className="mt-1 text-sm text-white/50">
                  Paste this before the closing {"</body>"} tag of your
                  website.
                </p>

                <div className="mt-4 overflow-auto rounded-2xl bg-black/40 p-5">
                  <pre className="text-sm text-cyan-300">
                    <code>{code}</code>
                  </pre>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyCode}
                    className="rounded-xl bg-white px-6 py-3 font-bold text-black"
                  >
                    {copied ? "Copied" : "Copy Embed Code"}
                  </button>

                  <button
                    type="button"
                    onClick={sendTestMessage}
                    disabled={testing || !aiEmployeeReady}
                    title={
                      aiEmployeeReady
                        ? undefined
                        : "Activate a Receptionist before testing."
                    }
                    className="rounded-xl border border-white/15 bg-white/[0.05] px-6 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testing ? "Sending..." : "Send a Test Message"}
                  </button>
                </div>

                {testResult ? (
                  <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/[0.05] p-4 text-sm text-cyan-100">
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-300/70">
                      Test response
                    </p>
                    <p className="mt-1">{testResult}</p>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-5">
                <p className="font-semibold">Website Widget is not active.</p>
                <p className="mt-2 text-sm text-white/60">
                  Activation creates a tenant-specific public key. No private
                  credentials are stored in your browser.
                </p>
                <button
                  type="button"
                  onClick={activateIntegration}
                  disabled={activating}
                  className="mt-5 rounded-xl bg-cyan-300 px-6 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {activating ? "Activating..." : "Activate Website Widget"}
                </button>
              </div>
            )}
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
