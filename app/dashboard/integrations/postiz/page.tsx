"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FaCheckCircle,
  FaFacebook,
  FaInstagram,
  FaLinkedin,
  FaTiktok,
  FaTimesCircle,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

type SocialAccount = {
  id?: string;
  identifier?: string;
  name?: string;
  displayName?: string;
  provider?: string;
  type?: string;
  platform?: string;
};

type PostizStatus = {
  connected?: boolean;
  status?: string;
  displayName?: string | null;
  accounts?: SocialAccount[];
  integrations?: SocialAccount[];
  integration?: {
    status?: string;
    displayName?: string | null;
  } | null;
};

function normalizeAccounts(data: PostizStatus): SocialAccount[] {
  if (Array.isArray(data.accounts)) {
    return data.accounts;
  }

  if (Array.isArray(data.integrations)) {
    return data.integrations;
  }

  return [];
}

export default function PostizIntegrationPage() {
  const router = useRouter();

  const [status, setStatus] = useState<PostizStatus | null>(null);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadStatus = async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/integrations/postiz/status", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load social account status.");
      }

      const data = (await response.json()) as PostizStatus;
      setStatus(data);
      setAccounts(normalizeAccounts(data));
    } catch (error) {
      console.error("Failed to load Postiz status:", error);
      setMessage("Social account status could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    async function fetchStatus() {
      try {
        const response = await fetch("/api/integrations/postiz/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load social account status.");
        }

        const data = (await response.json()) as PostizStatus;

        if (!active) {
          return;
        }

        setStatus(data);
        setAccounts(normalizeAccounts(data));
      } catch (error) {
        console.error("Failed to load Postiz status:", error);

        if (active) {
          setMessage("Social account status could not be loaded.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchStatus();

    return () => {
      active = false;
    };
  }, []);

  const connected =
    status?.connected === true ||
    status?.status === "active" ||
    status?.status === "connected" ||
    status?.integration?.status === "active";

  const connect = () => {
    router.push("/api/integrations/postiz/start");
  };

  const syncAccounts = async () => {
    setWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/integrations/postiz/sync", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Social accounts could not be synchronized.",
        );
      }

      const syncedAccounts = Array.isArray(data?.accounts)
        ? data.accounts
        : Array.isArray(data?.integrations)
          ? data.integrations
          : [];

      setAccounts(syncedAccounts);
      setMessage(
        `${syncedAccounts.length} social account${
          syncedAccounts.length === 1 ? "" : "s"
        } synchronized.`,
      );

      setStatus((current) => ({
        ...current,
        connected: true,
        status: "active",
      }));
    } catch (error) {
      console.error("Postiz sync failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Social accounts could not be synchronized.",
      );
    } finally {
      setWorking(false);
    }
  };

  const disconnect = async () => {
    const confirmed = window.confirm(
      "Disconnect your social accounts from SuperKuba?",
    );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    setMessage(null);

    try {
      const response = await fetch("/api/integrations/postiz/disconnect", {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Social accounts could not be disconnected.",
        );
      }

      setStatus({
        connected: false,
        status: "disconnected",
      });
      setAccounts([]);
      setMessage("Social accounts disconnected.");
    } catch (error) {
      console.error("Postiz disconnect failed:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Social accounts could not be disconnected.",
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/dashboard/integrations"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← Integrations
        </Link>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
            Social Channels
          </p>

          <h1 className="mt-3 text-4xl font-black">Social Accounts</h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">
            Connect your business social channels to SuperKuba so your AI
            workforce can manage social publishing and connected account
            workflows from one place.
          </p>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                {loading ? (
                  <div className="h-6 w-6 animate-pulse rounded-full bg-white/20" />
                ) : connected ? (
                  <FaCheckCircle className="text-green-400" size={24} />
                ) : (
                  <FaTimesCircle className="text-white/35" size={24} />
                )}

                <h2 className="text-xl font-bold">
                  {loading
                    ? "Checking connection"
                    : connected
                      ? "Social accounts connected"
                      : "Connect your social accounts"}
                </h2>
              </div>

              <p className="mt-3 text-sm text-white/50">
                {connected
                  ? `${accounts.length} connected social account${
                      accounts.length === 1 ? "" : "s"
                    } detected.`
                  : "Connect Facebook, Instagram, LinkedIn, X, TikTok and other supported channels."}
              </p>
            </div>

            {!loading && !connected && (
              <button
                type="button"
                onClick={connect}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
              >
                Connect Social Accounts
              </button>
            )}
          </div>

          {connected && (
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={working}
                onClick={() => void syncAccounts()}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {working ? "Working..." : "Sync Accounts"}
              </button>

              <button
                type="button"
                disabled={working}
                onClick={() => void disconnect()}
                className="rounded-xl border border-red-400/30 bg-red-400/10 px-5 py-3 text-sm font-bold text-red-200 transition hover:bg-red-400/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Disconnect
              </button>
            </div>
          )}

          {message && (
            <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/65">
              {message}
            </div>
          )}
        </section>

        <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
          <h2 className="text-lg font-bold">Supported social channels</h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { name: "Facebook", icon: <FaFacebook size={22} /> },
              { name: "Instagram", icon: <FaInstagram size={22} /> },
              { name: "LinkedIn", icon: <FaLinkedin size={22} /> },
              { name: "X", icon: <FaXTwitter size={22} /> },
              { name: "TikTok", icon: <FaTiktok size={22} /> },
            ].map((platform) => (
              <div
                key={platform.name}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <span className="text-white/75">{platform.icon}</span>
                <span className="text-sm font-semibold">{platform.name}</span>
              </div>
            ))}
          </div>

          {accounts.length > 0 && (
            <div className="mt-8">
              <h3 className="text-sm font-bold uppercase tracking-wide text-white/50">
                Connected accounts
              </h3>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {accounts.map((account, index) => (
                  <div
                    key={
                      account.id ??
                      account.identifier ??
                      `${account.provider ?? account.platform ?? "account"}-${index}`
                    }
                    className="rounded-2xl border border-green-400/15 bg-green-400/[0.04] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <FaCheckCircle className="text-green-400" />
                      <span className="font-semibold">
                        {account.displayName ??
                          account.name ??
                          account.identifier ??
                          "Connected account"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs uppercase tracking-wide text-white/35">
                      {account.provider ??
                        account.platform ??
                        account.type ??
                        "Social channel"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <p className="mt-5 text-xs text-white/25">
          Social account connectivity is securely powered by SuperKuba&apos;s
          social integration infrastructure.
        </p>
      </div>
    </main>
  );
}
