"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type Message = {
  id: string;
  role: "user" | "kuba";
  content: string;
};

const starterPrompts = [
  "What needs my attention today?",
  "How is my business performing?",
  "Which customers need follow-up?",
  "What can I do in SuperKuba?",
];

export default function AskKubaAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "kuba",
      content:
        "Hello. I’m Kuba, your business assistant. Ask me about your business, customers, workforce, performance, or how to use SuperKuba.",
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop =
          scrollRef.current.scrollHeight;
      }
    });
  }, [messages, open]);

  async function sendMessage(messageOverride?: string) {
    const message = (messageOverride ?? input).trim();

    if (!message || loading) return;

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "user",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/command-center",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to contact Kuba.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "kuba",
          content:
            data.response ||
            "I was unable to complete that request.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "kuba",
          content:
            "I could not connect right now. Please try again shortly.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void sendMessage();
  }

  return (
    <>
      {open && (
        <aside
          aria-label="Ask Kuba"
          className="fixed inset-y-0 right-0 z-[90] flex w-full flex-col border-l border-white/10 bg-[#08080D]/98 text-white shadow-2xl shadow-black/70 backdrop-blur-2xl sm:inset-y-auto sm:bottom-24 sm:right-6 sm:h-[min(720px,calc(100dvh-120px))] sm:w-[420px] sm:rounded-[30px] sm:border"
        >
          <header className="border-b border-white/10 bg-gradient-to-r from-cyan-500/10 via-violet-500/10 to-fuchsia-500/10 px-5 py-5 sm:rounded-t-[30px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                </div>

                <div>
                  <h2 className="font-black">Ask Kuba</h2>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Your SuperKuba business assistant
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close Ask Kuba"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-cyan-300 px-4 py-3 text-sm leading-6 text-black"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white/80"
                }
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="mr-auto rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white/45">
                Kuba is thinking…
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-2 text-left text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={submit}
            className="border-t border-white/10 p-4 sm:rounded-b-[30px]"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
              <input
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder="Ask Kuba anything about your business..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/30"
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300 text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </aside>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close Ask Kuba" : "Ask Kuba"}
        className="fixed bottom-5 right-4 z-[91] flex items-center gap-3 rounded-full border border-cyan-300/20 bg-[#0B0B10] px-4 py-3 text-sm font-black text-white shadow-2xl shadow-black/50 transition hover:-translate-y-0.5 hover:border-cyan-300/40 sm:right-6"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 to-violet-400 text-black">
          <Sparkles className="h-4 w-4" />
        </span>

        <span>Ask Kuba</span>

        {open && (
          <ChevronDown className="h-4 w-4 text-white/50" />
        )}
      </button>
    </>
  );
}
