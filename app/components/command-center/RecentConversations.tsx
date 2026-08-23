"use client";

import { useEffect, useState } from "react";

export default function RecentConversations() {
  const [messages, setMessages] = useState<Array<{
    id: string;
    senderType: string;
    content: string;
    timestamp?: string;
  }>>([]);

  useEffect(() => {
    fetch("/api/ai/conversations", {
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        setMessages(
          data.messages?.slice(-5).reverse() || [],
        );
      });
  }, []);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300/70">
        Activity Timeline
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Recent AI Activity
      </h2>

      <p className="mt-2 text-sm text-white/40">
        Real-time activity from your AI workforce handling customer interactions, tasks, and business operations.
      </p>

      <div className="mt-6 space-y-3">

        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
            <p className="text-sm text-white/40">
              Activity will appear here as your AI workforce handles conversations and tasks.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className="group relative rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.06] hover:border-white/15"
          >
            <div className="flex items-start gap-3">
              {/* Timeline Dot */}
              <div className="mt-1 flex flex-col items-center">
                <div className="h-3 w-3 rounded-full bg-gradient-to-br from-cyan-400 to-violet-400 shadow-lg shadow-cyan-400/50" />
                {index < messages.length - 1 && (
                  <div className="mt-2 h-6 w-px bg-gradient-to-b from-white/20 to-transparent" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-300/80">
                    {message.senderType || "AI Activity"}
                  </p>
                  <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    Active
                  </span>
                </div>

                <p className="mt-2 text-sm leading-5 text-white/70">
                  {message.content}
                </p>

                {message.timestamp && (
                  <p className="mt-2 text-xs text-white/30">
                    {new Date(message.timestamp).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}

      </div>

    </section>
  );
}
