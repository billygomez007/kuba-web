"use client";

import { useEffect, useState } from "react";
import EmptyState from "../EmptyState";

export default function RecentConversations() {
  const [messages, setMessages] = useState<any[]>([]);

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
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.04] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        Customer Activity
      </p>

      <h2 className="mt-2 text-2xl font-black">
        Recent Conversations
      </h2>

      <div className="mt-5 space-y-3">

        {messages.length === 0 && (
          <EmptyState
            icon="◌"
            title="Customer conversations will appear here"
            description="Connect a customer channel and your AI Receptionist can answer questions, capture enquiries, and keep your team informed."
            actionLabel="Connect Customer Channel"
            actionHref="/dashboard/integrations"
            compact
          />
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className="rounded-xl bg-black/20 p-4"
          >
            <p className="text-xs text-cyan-300">
              {message.senderType}
            </p>

            <p className="mt-1 text-sm text-white/70">
              {message.content}
            </p>
          </div>
        ))}

      </div>

    </section>
  );
}
