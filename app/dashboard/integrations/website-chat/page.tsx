"use client";

import { useState } from "react";


export default function WebsiteChatPage() {

  const [name, setName] = useState(
    "Realtegic Website Assistant",
  );

  const [websiteUrl, setWebsiteUrl] = useState(
    "https://www.realtegictravels.com",
  );

  const [loading, setLoading] = useState(false);

  const [created, setCreated] = useState<any>(null);


  async function createWidget() {

    setLoading(true);

    try {

      const response = await fetch(
        "/api/website-widgets",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name,
            websiteUrl,
          }),
        },
      );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to create widget",
        );
      }


      setCreated(data.widget);


    } catch (error) {

      alert(
        error instanceof Error
          ? error.message
          : "Something went wrong",
      );

    } finally {

      setLoading(false);

    }
  }


  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white">

      <div className="mx-auto max-w-5xl">

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
          Website Integration
        </p>

        <h1 className="mt-3 text-3xl font-black">
          Kuba Website Chat
        </h1>


        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-8">

          <h2 className="text-xl font-bold">
            Create Website Widget
          </h2>


          <div className="mt-6 space-y-4">

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="Widget name"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3"
            />


            <input
              value={websiteUrl}
              onChange={(e) =>
                setWebsiteUrl(e.target.value)
              }
              placeholder="Website URL"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-4 py-3"
            />


            <button
              onClick={createWidget}
              disabled={loading}
              className="rounded-xl bg-cyan-400 px-6 py-3 font-bold text-black"
            >
              {loading
                ? "Creating..."
                : "Create Website Widget"}
            </button>

          </div>


          {created && (
            <div className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 p-5">

              <h3 className="font-bold text-emerald-300">
                Widget Created
              </h3>

              <p className="mt-3 text-sm">
                ID: {created.id}
              </p>

              <p className="mt-2 text-sm">
                Public Key: {created.publicKey}
              </p>

            </div>
          )}


        </section>

      </div>

    </main>
  );
}
