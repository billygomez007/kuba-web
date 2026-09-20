"use client";

import {
  useParams,
} from "next/navigation";
import Link from "next/link";

export default function ProviderConnectionPage() {
  const params =
    useParams<{
      provider: string;
    }>();

  const provider =
    decodeURIComponent(
      params.provider || "",
    );

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <Link
          href="/dashboard/integrations"
          className="text-xs font-semibold text-white/40 hover:text-cyan-300"
        >
          ← Integrations
        </Link>

        <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
          Provider setup
        </p>

        <h1 className="mt-3 text-3xl font-black">
          {provider
            .replaceAll(
              "_",
              " ",
            )
            .replace(
              /\b\w/g,
              (value) =>
                value.toUpperCase(),
            )}
        </h1>

        <p className="mt-4 text-white/50">
          This provider is now registered
          in SuperKuba's integration
          platform. The next implementation
          pass adds its provider-specific
          authorization, credential
          validation, synchronization and
          webhook lifecycle.
        </p>

        <div className="mt-8 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.04] p-4 text-sm text-cyan-100/70">
          SuperKuba will not mark this
          integration connected until the
          external provider has
          authenticated successfully.
        </div>
      </div>
    </main>
  );
}
