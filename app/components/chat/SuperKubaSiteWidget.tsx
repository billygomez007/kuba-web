"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  MessageCircle,
  Send,
  Sparkles,
  X,
} from "lucide-react";

type ChatMessage = {
  id: string;
  role: "visitor" | "kuba";
  content: string;
};

const welcomeMessage =
  "Hi, I’m Kuba. I can help you understand SuperKuba, explore AI employees, integrations, pricing, and how to get started.";

const quickPrompts = [
  "What can SuperKuba do?",
  "Which AI employees can I hire?",
  "How does pricing work?",
  "How do I get started?",
];

export default function SuperKubaSiteWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] =
    useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "kuba",
      content: welcomeMessage,
    },
  ]);
  const [loading, setLoading] = useState(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);

  const publicKey =
    process.env.NEXT_PUBLIC_SUPERKUBA_WIDGET_PUBLIC_KEY || "";

  useEffect(() => {
    if (!open) return;

    requestAnimationFrame(() => {
      if (messagesRef.current) {
        messagesRef.current.scrollTop =
          messagesRef.current.scrollHeight;
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
        role: "visitor",
        content: message,
      },
    ]);

    setInput("");
    setLoading(true);

    try {
      if (!publicKey) {
        throw new Error("Website assistant is not configured.");
      }

      const response = await fetch(
        "/api/integrations/website-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            publicKey,
            message,
            conversationId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to contact Kuba.",
        );
      }

      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "kuba",
          content:
            data.response ||
            "I’m sorry, I could not respond right now.",
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "kuba",
          content:
            "I’m having trouble connecting right now. You can still create an account or explore SuperKuba from the website.",
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
        <section
          aria-label="Talk to Kuba"
          className="fixed bottom-24 right-4 z-[80] flex h-[min(650px,calc(100dvh-120px))] w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#0A0A0F]/95 text-white shadow-2xl shadow-black/60 backdrop-blur-2xl sm:right-6"
        >
          <header className="border-b border-white/10 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-cyan-400/10 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.07]">
                  <Sparkles className="h-5 w-5 text-cyan-300" />
                </div>

                <div>
                  <p className="font-black">Talk to Kuba</p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-white/45">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    SuperKuba AI
                  </div>
                </div>
              </div>

              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="rounded-xl p-2 text-white/50 transition hover:bg-white/[0.07] hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div
            ref={messagesRef}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-5"
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "visitor"
                    ? "ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm leading-6 text-black"
                    : "mr-auto max-w-[90%] rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.055] px-4 py-3 text-sm leading-6 text-white/80"
                }
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="mr-auto rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-white/45">
                Kuba is thinking…
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void sendMessage(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={submit}
            className="border-t border-white/10 p-4"
          >
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
              <input
                value={input}
                onChange={(event) =>
                  setInput(event.target.value)
                }
                placeholder="Ask about SuperKuba..."
                className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/30"
              />

              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label="Send message"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close Kuba chat" : "Talk to Kuba"}
        className="fixed bottom-5 right-4 z-[81] flex items-center gap-3 rounded-full border border-white/10 bg-white px-4 py-3 font-bold text-black shadow-2xl shadow-violet-950/40 transition hover:-translate-y-0.5 sm:right-6"
      >
        {open ? (
          <ChevronDown className="h-5 w-5" />
        ) : (
          <MessageCircle className="h-5 w-5" />
        )}

        <span>Talk to Kuba</span>
      </button>
    </>
  );
}
