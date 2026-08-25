"use client";

import { useEffect, useState } from "react";

type WebsiteChatIntegration = {
  id: string;
  publicKey: string | null;
  status: string | null;
  displayName: string | null;
  metadata: string | null;
};

function getMetadataValue(metadata: string | null, key: string) {
  if (!metadata) return null;

  try {
    const parsed = JSON.parse(metadata) as Record<string, unknown>;
    const value = parsed[key];
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

export default function WebsiteChatPage() {
  const [integration, setIntegration] = useState<WebsiteChatIntegration | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/integrations/website-chat", { cache: "no-store" });
        const data = await res.json();
        setIntegration(data.integration || null);
      } catch (error) {
        console.error("Failed to load Website Chat config:", error);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const statusLabel = integration?.status === "active" ? "Enabled" : integration ? "Configuration Required" : "Not Configured";
  const publicKey = integration?.publicKey || "";
  const domain = getMetadataValue(integration?.metadata || null, "websiteUrl") || getMetadataValue(integration?.metadata || null, "domain") || "Not configured";
  const assignedEmployee = getMetadataValue(integration?.metadata || null, "employeeId") || "Unassigned";
  const code = publicKey
    ? `<script src="/kuba/chat.js" data-public-key="${publicKey}"></script>`
    : "Website chat is not configured for this business yet.";

  function copyCode() {
    if (!publicKey) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Communication channels</p>
            <h1 className="mt-2 text-3xl font-black">Website Chat</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${integration?.status === "active" ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/70"}`}>
            {statusLabel}
          </span>
        </div>

        <p className="mt-3 text-white/50">
          This widget is scoped to the selected business. The public key identifies the tenant without exposing a secret.
        </p>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">Loading widget configuration…</div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Widget status</p>
              <p className="mt-2 text-lg font-bold">{statusLabel}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Public key</p>
              <p className="mt-2 break-all font-mono text-sm text-white/80">{publicKey || "Not available"}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Website domain</p>
              <p className="mt-2 text-sm text-white/80">{domain}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-xs uppercase tracking-wide text-white/40">Assigned AI employee</p>
              <p className="mt-2 text-sm text-white/80">{assignedEmployee}</p>
            </div>
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-black/30 p-5">
          <p className="text-xs uppercase tracking-wide text-white/40">Installation snippet</p>
          <div className="mt-4 overflow-auto rounded-xl bg-black/40 p-4">
            <code className="text-sm text-cyan-300">{code}</code>
          </div>
          {publicKey && (
            <button type="button" onClick={copyCode} className="mt-5 rounded-xl bg-white px-6 py-3 font-bold text-black">
              {copied ? "Copied" : "Copy snippet"}
            </button>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/30">Recent activity</p>
          <p className="mt-2 text-sm text-white/45">No recent widget activity is exposed from the staging environment for this business.</p>
        </div>
      </div>
    </main>
  );
}
