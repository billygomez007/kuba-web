"use client";

import { useEffect, useState } from "react";

type EmailIntegration = {
  provider: string;
  status: string;
  displayName: string | null;
  metadata: string | null;
};

export default function EmailIntegrationPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Not Configured");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/integrations", { cache: "no-store" });
        const data = await res.json();
        const record = data.integrations?.find((item: EmailIntegration) => item.provider === "email");
        if (record) {
          setEmail(record.displayName || "");
          setStatus(record.status === "active" ? "Transactional email only" : "Configuration Required");
        }
      } catch (error) {
        console.error("Failed to load email integration status:", error);
      }
    };

    void load();
  }, []);

  async function connectEmail() {
    const response = await fetch("/api/integrations/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();

    if (data.success) {
      setStatus("Transactional email only");
      setMessage("Saved for auth and transactional email use. Customer outbound email remains disabled unless explicitly configured in staging.");
    } else {
      setMessage(data.error || "Connection failed.");
    }
  }

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">
      <div className="mx-auto max-w-3xl rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Communication channels</p>
            <h1 className="mt-2 text-3xl font-black">Email</h1>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/80">{status}</span>
        </div>

        <p className="mt-3 text-white/50">
          Current staging status reflects the actual email capability in use: auth and transactional email are separate from customer outbound messaging.
        </p>

        <div className="mt-8 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-5">
          <p className="text-sm text-amber-200">This environment does not treat Email as active outbound customer messaging unless there is a safe, explicitly configured provider.</p>
        </div>

        <div className="mt-8 space-y-4">
          <label className="block text-sm font-semibold text-white/70">Business email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Business email address"
            className="w-full rounded-xl bg-black/30 p-4 text-white outline-none ring-0 placeholder:text-white/30"
          />

          <button onClick={connectEmail} className="rounded-xl bg-white px-8 py-4 font-bold text-black">
            Save transactional email config
          </button>

          {message && <p className="text-sm text-cyan-300">{message}</p>}
        </div>
      </div>
    </main>
  );
}
