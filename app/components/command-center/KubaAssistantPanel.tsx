"use client";

import { useState } from "react";

export default function KubaAssistantPanel() {
  const [message, setMessage] = useState("");

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
        Kuba Executive Assistant
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Ask Kuba about your business
      </h2>

      <p className="mt-2 max-w-2xl text-sm text-white/40">
        Get insights about sales, customers, operations, and your AI workforce.
      </p>


      <div className="mt-6 flex gap-3">

        <input
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          placeholder="How is my business performing today?"
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30"
        />


        <button
          className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
        >
          Ask Kuba
        </button>

      </div>

    </section>
  );
}
