import Link from "next/link";

export default function MetaIntegrationPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <Link href="/dashboard/integrations" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Integrations</Link>

        <h1 className="mt-5 text-3xl font-black">
          Facebook & Instagram
        </h1>

        <p className="mt-3 text-white/50">
          Connect your Meta accounts so Kuba can manage customer conversations from Facebook Messenger and Instagram.
        </p>

        <button
          type="button"
          disabled
          className="mt-8 cursor-not-allowed rounded-xl bg-white/10 px-8 py-4 font-bold text-white/35"
        >
          Coming soon
        </button>

        <p className="mt-3 text-xs text-white/35">
          Facebook and Instagram messaging is not yet available in SuperKuba.
        </p>

      </div>

    </main>
  );
}
