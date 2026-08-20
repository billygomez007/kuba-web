"use client";

export default function TelegramIntegrationPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">

        <h1 className="text-3xl font-black">
          Telegram Integration
        </h1>

        <p className="mt-3 text-white/50">
          Connect your Telegram business bot so Kuba can communicate with customers.
        </p>

        <div className="mt-8 space-y-4">

          <input
            placeholder="Telegram Bot Token"
            className="w-full rounded-xl bg-black/30 p-4"
          />

          <button
            className="rounded-xl bg-white px-8 py-4 font-bold text-black"
          >
            Connect Telegram
          </button>

        </div>

      </div>

    </main>
  );
}
