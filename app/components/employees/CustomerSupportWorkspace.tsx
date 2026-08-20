"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Props = {
  employeeId: string;
  employeeName: string;
};

export default function CustomerSupportWorkspace({
  employeeId,
  employeeName,
}: Props) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        `Hi. I'm ${employeeName}. Tell me what customer issue you'd like me to help with.`,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
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
      const response = await fetch(
        "/api/ai/customer-support",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmedMessage,
            employeeId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Customer Support could not respond.",
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
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

      <section className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">

        <div className="border-b border-white/10 px-6 py-5">
          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-400/10 text-lg">
              ◉
            </div>

            <div>
              <h2 className="font-bold text-white">
                Chat with {employeeName}
              </h2>

              <p className="text-xs text-white/30">
                Customer support workspace
              </p>
            </div>

          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">

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
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/[0.04] text-white/70"
                }`}
              >
                {item.content}
              </div>
            </div>
          ))}

          <div ref={bottomRef} />

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm text-white/35">
                {employeeName} is thinking...
              </div>
            </div>
          )}

        </div>

        <div className="shrink-0 border-t border-white/10 bg-black/10 p-5">

          <form
            onSubmit={handleSubmit}
            className="flex gap-3"
          >
            <input
              value={message}
              onChange={(event) =>
                setMessage(event.target.value)
              }
              placeholder="Describe a customer issue..."
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-400/40"
            />

            <button
              type="submit"
              disabled={loading || !message.trim()}
              className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Working..." : "Send"}
            </button>
          </form>

        </div>

      </section>

      <aside className="space-y-4">

        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60">
            Specializes in
          </p>

          <ul className="mt-5 space-y-3 text-sm text-white/50">
            <li>✓ Customer questions</li>
            <li>✓ Complaint handling</li>
            <li>✓ Troubleshooting</li>
            <li>✓ Customer identification</li>
            <li>✓ Support escalation</li>
          </ul>

        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
            Status
          </p>

          <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Ready to work
          </div>

        </div>

      </aside>

    </div>
  );
}
