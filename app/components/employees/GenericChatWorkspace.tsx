"use client";

import { FormEvent, useState } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// Every implemented employee type is reachable at /api/ai/{type} with the
// same { message, employeeId } request shape (mirrors the per-employee
// test console at app/dashboard/ai-employees/[id]/test/page.tsx) — this is
// a real, working chat against the actual agent, not a placeholder, for
// any type that doesn't (yet) have a bespoke dashboard-style workspace.
const RUNTIME_ENDPOINT: Record<string, string> = {
  receptionist: "/api/ai/receptionist",
  sales: "/api/ai/sales",
  "customer-support": "/api/ai/customer-support",
  outreach: "/api/ai/outreach",
  "general-manager": "/api/ai/general-manager",
  marketing: "/api/ai/marketing",
  appointment: "/api/ai/appointment",
};

type Props = {
  employeeId: string;
  employeeName: string;
  employeeType: string;
};

export default function GenericChatWorkspace({ employeeId, employeeName, employeeType }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const endpoint = RUNTIME_ENDPOINT[employeeType];

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || sending) return;

    if (!endpoint) {
      setError("This employee type does not have a connected runtime yet.");
      return;
    }

    setInput("");
    setError("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content: message }]);
    setSending(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, employeeId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The AI employee could not respond.");
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "assistant", content: data.response || "No response was returned." },
      ]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Unable to reach this employee. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6 sm:p-8">
      <h2 className="text-xl font-bold">{employeeName}</h2>
      <p className="mt-1 text-sm text-white/40">
        Talk to {employeeName} directly. Full activity dashboards for this employee type are still being built —
        this is a real, working conversation with the actual employee, not a preview.
      </p>

      <div className="mt-6 min-h-[240px] space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        {messages.length === 0 && (
          <p className="text-sm text-white/30">No messages yet. Say hello to get started.</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === "user" ? "text-right" : "text-left"}
          >
            <span
              className={
                message.role === "user"
                  ? "inline-block max-w-[85%] rounded-2xl bg-cyan-400/15 px-4 py-2 text-sm text-cyan-100"
                  : "inline-block max-w-[85%] rounded-2xl bg-white/[0.06] px-4 py-2 text-sm text-white/80"
              }
            >
              {message.content}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`Message ${employeeName}...`}
          disabled={sending || !endpoint}
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !input.trim() || !endpoint}
          className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </section>
  );
}
