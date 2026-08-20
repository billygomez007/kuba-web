"use client";

import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ReceptionistEmployeeChat() {
  const [conversationId] = useState(() =>
    crypto.randomUUID(),
  );

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello. I'm Kuba Receptionist. How can I help you or your customers today?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedMessage,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch("/api/ai/receptionist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
       body: JSON.stringify({
  message: trimmedMessage,
  conversationId,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Kuba Receptionist could not respond.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]">
      <div className="border-b border-white/10 px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">
              AI Receptionist
            </p>

            <h3 className="mt-2 text-xl font-bold text-white">
              Talk to Kuba Receptionist
            </h3>

            <p className="mt-1 text-sm text-white/50">
              Test how your AI receptionist handles customer enquiries.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Active
          </div>
        </div>
      </div>

      <div className="min-h-[420px] space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((item, index) => (
          <div
            key={index}
            className={`flex ${
              item.role === "user"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-5 py-4 text-sm leading-6 ${
                item.role === "user"
                  ? "bg-violet-500 text-white"
                  : "border border-white/10 bg-white/[0.06] text-white/75"
              }`}
            >
              {item.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-4 text-sm text-white/50">
              Kuba Receptionist is thinking...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-black/10 p-5">
        <form
          onSubmit={handleSubmit}
          className="flex gap-3"
        >
          <input
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Ask Kuba Receptionist something..."
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-violet-400/50"
          />

          <button
            type="submit"
            disabled={loading || !message.trim()}
            className="rounded-xl bg-violet-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Working..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}