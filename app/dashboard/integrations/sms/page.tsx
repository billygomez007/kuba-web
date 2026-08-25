"use client";

export default function SMSIntegrationPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <h1 className="text-3xl font-black">SMS Integration</h1>

        <p className="mt-3 text-white/50">
          Connect SMS messaging so Kuba can communicate with customers via text.
        </p>

        <div className="mt-8 space-y-4 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4">
          <p className="text-sm text-amber-200">
            SMS integration is coming soon. This feature will allow you to send and receive SMS messages through Kuba.
          </p>
          <p className="text-xs text-amber-100/60">
            Supported providers: Twilio, AWS SNS, and more
          </p>
        </div>

        <button
          disabled
          className="mt-8 rounded-xl bg-white/20 px-8 py-4 font-bold text-white opacity-50"
        >
          Coming Soon
        </button>
      </div>
    </main>
  );
}
