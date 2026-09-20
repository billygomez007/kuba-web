"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import Link from "next/link";

type Status = {
  connected: boolean;
  displayName?: string | null;
  environmentUrl?: string | null;
  organizationId?: string | null;
};

export default function MicrosoftDynamicsPage() {
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
    error,
    setError,
  ] =
    useState("");

  async function load() {
    try {
      const response =
        await fetch(
          "/api/integrations/microsoft-dynamics/status",
          {
            cache:
              "no-store",
          },
        );

      const body =
        await response.json();

      if (
        response.ok
      ) {
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

  function connect(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    const form =
      new FormData(
        event.currentTarget,
      );

    const environmentUrl =
      String(
        form.get(
          "environmentUrl",
        ) || "",
      ).trim();

    if (
      !environmentUrl
    ) {
      setError(
        "Enter your Dynamics 365 environment URL.",
      );

      return;
    }

    const url =
      new URL(
        "/api/integrations/microsoft-dynamics/start",
        window.location.origin,
      );

    url.searchParams.set(
      "environmentUrl",
      environmentUrl,
    );

    window.location.assign(
      url.toString(),
    );
  }

  async function disconnect() {
    const response =
      await fetch(
        "/api/integrations/microsoft-dynamics/disconnect",
        {
          method:
            "POST",
        },
      );

    if (!response.ok) {
      setError(
        "Unable to disconnect Dynamics 365.",
      );

      return;
    }

    await load();
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/dashboard/integrations/crm"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← CRM integrations
        </Link>

        <h1 className="mt-5 text-3xl font-black">
          Microsoft Dynamics 365
        </h1>

        <p className="mt-3 text-white/50">
          Connect your Dynamics 365 /
          Microsoft Dataverse environment
          so SuperKuba can work with
          authorized accounts, contacts and
          opportunities.
        </p>

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
              {status.displayName ||
                "Microsoft Dynamics 365"}
            </h2>

            <p className="mt-3 break-all text-sm text-white/50">
              {status.environmentUrl}
            </p>

            <button
              type="button"
              onClick={() =>
                void disconnect()
              }
              className="mt-6 rounded-xl border border-red-300/20 px-5 py-3 text-sm font-bold text-red-200"
            >
              Disconnect
            </button>
          </section>
        ) : (
          <form
            onSubmit={connect}
            className="mt-8 space-y-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >
            <label className="block">
              <span className="text-sm font-semibold">
                Dynamics environment URL
              </span>

              <input
                name="environmentUrl"
                type="url"
                required
                placeholder="https://yourcompany.crm.dynamics.com"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-cyan-300/40"
              />
            </label>

            <p className="text-xs leading-5 text-white/35">
              Use the Environment URL from
              your Dynamics 365 / Power
              Platform developer resources.
            </p>

            <button
              type="submit"
              className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-black"
            >
              Connect Dynamics 365
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
