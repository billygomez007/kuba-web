"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  useRouter,
} from "next/navigation";

type ProviderStatus = {
  id: string;
  name: string;
  category: string;
  connectionType: string;
  environmentReady: boolean;
  connected: boolean;
  status: string;
  displayName: string | null;
};

export default function ProviderGrid({
  category,
  title,
  description,
}: {
  category: string;
  title: string;
  description: string;
}) {
  const router =
    useRouter();

  const [
    providers,
    setProviders,
  ] = useState<
    ProviderStatus[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    const load =
      async () => {
        try {
          const response =
            await fetch(
              "/api/integrations/provider-status",
              {
                cache:
                  "no-store",
              },
            );

          const body =
            await response.json();

          if (!response.ok) {
            throw new Error(
              body.error ||
                "Unable to load integrations.",
            );
          }

          setProviders(
            (
              body.providers ||
              []
            ).filter(
              (
                provider:
                  ProviderStatus,
              ) =>
                provider.category ===
                category,
            ),
          );
        } catch (
          cause
        ) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to load integrations.",
          );
        } finally {
          setLoading(false);
        }
      };

    void load();
  }, [category]);

  async function connect(
    providerId: string,
  ) {
    setError("");

    const response =
      await fetch(
        "/api/integrations/connect",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              provider:
                providerId,
            }),
        },
      );

    const body =
      await response.json();

    if (!response.ok) {
      setError(
        body.error ||
          "Unable to start connection.",
      );
      return;
    }

    if (
      body.redirectUrl
    ) {
      router.push(
        body.redirectUrl,
      );
      return;
    }

    if (body.next) {
      router.push(
        body.next,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-black">
          {title}
        </h1>

        <p className="mt-3 max-w-3xl text-white/50">
          {description}
        </p>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="mt-10 text-sm text-white/40">
            Loading integrations…
          </div>
        ) : (
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {providers.map(
              (provider) => (
                <section
                  key={
                    provider.id
                  }
                  className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold">
                        {
                          provider.name
                        }
                      </h2>

                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/35">
                        {
                          provider.connectionType
                        }
                      </p>
                    </div>

                    <span
                      className={
                        provider.connected
                          ? "rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-300"
                          : "rounded-full bg-cyan-300/10 px-3 py-1 text-xs font-bold text-cyan-200"
                      }
                    >
                      {provider.connected
                        ? "Connected"
                        : "Available"}
                    </span>
                  </div>

                  {provider.displayName && (
                    <p className="mt-4 text-sm text-white/55">
                      {
                        provider.displayName
                      }
                    </p>
                  )}

                  {!provider.environmentReady &&
                    provider.connectionType ===
                      "oauth" && (
                      <p className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-3 text-xs text-amber-100/70">
                        Provider credentials
                        must be configured
                        before authorization
                        can begin.
                      </p>
                    )}

                  <button
                    type="button"
                    onClick={() =>
                      void connect(
                        provider.id,
                      )
                    }
                    className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
                  >
                    {provider.connected
                      ? "Manage"
                      : "Connect"}
                  </button>
                </section>
              ),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
