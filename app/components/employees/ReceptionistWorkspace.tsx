"use client";

import { useEffect, useRef, useState } from "react";

type Message = {
  role: "kuba" | "customer";
  text: string;
};

export default function ReceptionistWorkspace() {
  const [conversationId] = useState(() =>
    crypto.randomUUID(),
  );

  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);

  const [loading, setLoading] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);


  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await fetch(
          "/api/ai/receptionist/history",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) return;

        const data = await response.json();

        if (data.messages?.length) {
          setMessages(
            data.messages.map((item: { senderType?: string; content?: string }) => ({
              role:
                item.senderType === "customer"
                  ? "customer"
                  : "kuba",
              text: typeof item.content === "string" ? item.content : "",
            })),
          );
        } else {
          setMessages([
            {
              role: "kuba",
              text:
                "Hello, I am Kuba Receptionist. How can I help your customers today?",
            },
          ]);
        }

      } catch (error) {
        console.error(
          "Receptionist history error",
          error,
        );
      }
    }

    loadHistory();
  }, []);


  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);


  async function sendMessage() {
    if (!message.trim() || loading) return;

    const userMessage = message;

    setMessages((prev) => [
      ...prev,
      {
        role: "customer",
        text: userMessage,
      },
    ]);

    setMessage("");
    setLoading(true);


    try {
      const response = await fetch(
        "/api/ai/receptionist",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: userMessage,
            conversationId,
          }),
        },
      );


      const data = await response.json();


      setMessages((prev) => [
        ...prev,
        {
          role: "kuba",
          text:
            data.response ||
            "I was unable to respond.",
        },
      ]);

    } catch {

      setMessages((prev) => [
        ...prev,
        {
          role: "kuba",
          text: "Connection error.",
        },
      ]);

    } finally {
      setLoading(false);
    }
  }


  return (
    <section className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
        Customer Reception Desk
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Kuba Receptionist Workspace
      </h2>


      <div className="mt-5 max-h-[500px] space-y-3 overflow-y-auto rounded-2xl bg-black/20 p-4">

        {messages.map((item, index) => (
          <div
            key={index}
            className="rounded-xl bg-white/[0.05] p-3 text-sm"
          >
            <b>
              {item.role === "kuba"
                ? "Kuba"
                : "Customer"}:
            </b>{" "}
            {item.text}
          </div>
        ))}

        <div ref={bottomRef} />

      </div>


      <div className="mt-5 flex gap-3">

        <input
          value={message}
          onChange={(e) =>
            setMessage(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              sendMessage();
            }
          }}
          placeholder="Test customer message..."
          className="flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
        />


        <button
          onClick={sendMessage}
          disabled={loading}
          className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
        >
          {loading ? "Replying..." : "Send"}
        </button>

      </div>

    </section>
  );
}
