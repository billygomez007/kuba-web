"use client";

import { FormEvent, useEffect, useState } from "react";

type Status = {
  connected: boolean;
  status: string;
  displayName: string | null;
  externalAccountId: string | null;
};

export default function PaystackMerchantPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [secretKey, setSecretKey] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadStatus() {
    const response = await fetch(
      "/api/integrations/paystack-merchant/status",
      { cache: "no-store" },
    );

    if (response.ok) {
      setStatus(await response.json());
    }
  }

  useEffect(() => {
    void loadStatus();
  }, []);

  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch(
        "/api/integrations/paystack-merchant/connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ secretKey, displayName }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Connection failed.");
      }

      setSecretKey("");
      setMessage("Paystack merchant account connected.");
      await loadStatus();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Connection failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function testConnection() {
    setBusy(true);
    setMessage("");

    const response = await fetch(
      "/api/integrations/paystack-merchant/test",
      { method: "POST" },
    );

    const data = await response.json();

    setMessage(
      response.ok
        ? "Paystack connection verified."
        : data.error || "Verification failed.",
    );

    setBusy(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect this Paystack account?")) return;

    setBusy(true);

    await fetch(
      "/api/integrations/paystack-merchant/disconnect",
      { method: "POST" },
    );

    setMessage("Paystack disconnected.");
    await loadStatus();
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <p className="text-sm font-medium text-amber-500">
          Merchant Payments
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Paystack
        </h1>
        <p className="mt-3 text-sm text-zinc-500">
          Connect this business&apos;s own Paystack merchant account.
          These credentials are separate from SuperKuba subscription
          billing.
        </p>
      </div>

      {status?.connected ? (
        <section className="space-y-4 rounded-2xl border p-6">
          <div>
            <p className="text-sm text-zinc-500">Connected account</p>
            <p className="font-medium">
              {status.displayName || "Paystack"}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={testConnection}
              className="rounded-xl border px-4 py-2"
            >
              Test connection
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={disconnect}
              className="rounded-xl border px-4 py-2"
            >
              Disconnect
            </button>
          </div>
        </section>
      ) : (
        <form
          onSubmit={connect}
          className="space-y-5 rounded-2xl border p-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium">
              Account name
            </label>
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="My business Paystack"
              className="w-full rounded-xl border bg-transparent px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">
              Paystack secret key
            </label>
            <input
              type="password"
              required
              value={secretKey}
              onChange={(event) => setSecretKey(event.target.value)}
              placeholder="sk_live_..."
              autoComplete="off"
              className="w-full rounded-xl border bg-transparent px-4 py-3"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Stored encrypted. SuperKuba will never display the key
              again after connection.
            </p>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="rounded-xl bg-foreground px-5 py-3 text-background"
          >
            {busy ? "Verifying..." : "Connect Paystack"}
          </button>
        </form>
      )}

      {message ? (
        <p className="rounded-xl border p-4 text-sm">{message}</p>
      ) : null}
    </main>
  );
}
