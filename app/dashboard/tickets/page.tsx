"use client";

import { useEffect, useState } from "react";

import {
  Ticket,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  Bot,
} from "lucide-react";


type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string | null;
};


export default function TicketsPage() {

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "",
  });


  useEffect(() => {

    async function loadTickets() {

      try {

        const response =
          await fetch("/api/tickets", {
            cache: "no-store",
          });


        const data =
          await response.json();


        setTickets(
          data.tickets || [],
        );


      } catch(error) {

        console.error(
          "Ticket loading error:",
          error,
        );

      } finally {

        setLoading(false);

      }

    }


    loadTickets();

  }, []);



  const stats = [
    {
      title: "Open Tickets",
      value: "0",
      icon: Ticket,
    },
    {
      title: "Urgent Issues",
      value: "0",
      icon: AlertTriangle,
    },
    {
      title: "Waiting Reply",
      value: "0",
      icon: Clock,
    },
    {
      title: "Resolved Today",
      value: "0",
      icon: CheckCircle,
    },
  ];



  async function createTicket() {

    try {

      const response =
        await fetch("/api/tickets", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        });


      if (!response.ok) {
        throw new Error("Unable to create ticket");
      }


      setForm({
        title: "",
        description: "",
        priority: "medium",
        category: "",
      });


      setShowCreate(false);


      const refresh =
        await fetch("/api/tickets", {
          cache: "no-store",
        });


      const data =
        await refresh.json();


      setTickets(data.tickets || []);


    } catch(error) {

      console.error(
        "Create ticket error:",
        error,
      );

    }

  }


  const views = [
    "All Tickets",
    "My Tickets",
    "Urgent",
    "Unassigned",
    "Waiting Customer",
    "Resolved",
  ];


  return (

    <main className="min-h-screen bg-[#050507] p-8 text-white">

      <div className="max-w-[1500px]">


        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
          Customer Operations
        </p>


        <h1 className="mt-3 text-4xl font-black">
          Ticket Center
        </h1>


        <p className="mt-3 max-w-3xl text-white/50">
          Manage customer issues, support requests, and AI-powered resolutions from one workspace.
        </p>



        {/* STATS */}

        <div className="mt-10 grid gap-5 md:grid-cols-4">

          {stats.map((item)=>{

            const Icon = item.icon;

            return (

              <div
                key={item.title}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
              >

                <Icon className="h-6 w-6 text-cyan-300" />

                <p className="mt-5 text-3xl font-black">
                  {item.value}
                </p>

                <p className="mt-2 text-sm text-white/50">
                  {item.title}
                </p>

              </div>

            );

          })}

        </div>




        {/* WORKSPACE */}

        <div className="mt-10 grid gap-6 lg:grid-cols-[240px_1fr_320px]">


          {/* LEFT */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">

            <p className="text-xs font-bold uppercase tracking-widest text-white/30">
              Views
            </p>


            <div className="mt-5 space-y-2">

              {views.map((view)=>(

                <button
                  key={view}
                  className="w-full rounded-xl px-4 py-3 text-left text-sm text-white/60 transition hover:bg-white/[0.06] hover:text-white"
                >
                  {view}
                </button>

              ))}

            </div>

          </div>




          {/* CENTER */}

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">


            <div className="flex items-center justify-between">

              <h2 className="text-2xl font-black">
                Ticket Queue
              </h2>


              <button
                onClick={() => setShowCreate(true)}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                Create Ticket
              </button>

            </div>



            <div className="mt-6 flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">

              <Search className="h-4 w-4 text-white/40"/>

              <span className="text-sm text-white/40">
                Search tickets...
              </span>

            </div>



            <div className="mt-8 space-y-4">

              {loading && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/40">
                  Loading tickets...
                </div>
              )}


              {!loading && tickets.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center">

                  <Ticket className="mx-auto h-10 w-10 text-white/20"/>

                  <p className="mt-4 text-white/40">
                    No tickets available yet.
                  </p>

                  <p className="mt-2 text-sm text-white/25">
                    Tickets created from Kuba AI conversations will appear here.
                  </p>

                </div>
              )}


              {tickets.map((ticket) => (

                <div
                  key={ticket.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <h3 className="font-bold">
                        {ticket.title}
                      </h3>

                      <p className="mt-2 text-sm text-white/50">
                        {ticket.description || "No description provided."}
                      </p>

                    </div>


                    <div className="space-y-2 text-right">

                      <span className="block rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
                        {ticket.status}
                      </span>


                      <span className="block rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-300">
                        {ticket.priority}
                      </span>

                    </div>

                  </div>


                  {ticket.category && (
                    <p className="mt-4 text-xs text-white/30">
                      Category: {ticket.category}
                    </p>
                  )}

                </div>

              ))}

            </div>


          </div>





          {/* RIGHT */}

          <div className="rounded-3xl border border-violet-400/20 bg-violet-400/[0.05] p-6">


            <div className="flex items-center gap-3">

              <Bot className="h-6 w-6 text-violet-300"/>

              <h2 className="font-black">
                Kuba AI Intelligence
              </h2>

            </div>



            <p className="mt-5 text-sm leading-7 text-white/50">
              Kuba will analyze every ticket, identify customer sentiment, classify issues, suggest replies, and recommend the next action.
            </p>



            <div className="mt-6 space-y-3 text-sm">

              <div className="rounded-xl bg-black/20 p-4">
                Sentiment Analysis
              </div>

              <div className="rounded-xl bg-black/20 p-4">
                Automatic Priority Detection
              </div>

              <div className="rounded-xl bg-black/20 p-4">
                Suggested Resolution
              </div>

            </div>


          </div>


        </div>


      </div>


      {showCreate && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">

          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b10] p-6">


            <h2 className="text-2xl font-black">
              Create New Ticket
            </h2>


            <p className="mt-2 text-sm text-white/40">
              Create a customer support request.
            </p>



            <div className="mt-6 space-y-4">


              <input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                placeholder="Ticket title"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />



              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                placeholder="Describe the issue"
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />



              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
              >

                <option value="low">
                  Low
                </option>

                <option value="medium">
                  Medium
                </option>

                <option value="high">
                  High
                </option>

                <option value="urgent">
                  Urgent
                </option>

              </select>



              <input
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
                placeholder="Category (Billing, Support, Sales...)"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />

            </div>



            <div className="mt-6 flex justify-end gap-3">


              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60"
              >
                Cancel
              </button>



              <button
                onClick={createTicket}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                Create Ticket
              </button>


            </div>


          </div>

        </div>

      )}


      {showCreate && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-5">

          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b10] p-6">

            <h2 className="text-2xl font-black">
              Create New Ticket
            </h2>

            <p className="mt-2 text-sm text-white/40">
              Create a customer support request.
            </p>


            <div className="mt-6 space-y-4">

              <input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                placeholder="Ticket title"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />


              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm({
                    ...form,
                    description: e.target.value,
                  })
                }
                placeholder="Describe the issue"
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />


              <select
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>


              <input
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value,
                  })
                }
                placeholder="Category"
                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
              />

            </div>


            <div className="mt-6 flex justify-end gap-3">

              <button
                onClick={() => setShowCreate(false)}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60"
              >
                Cancel
              </button>


              <button
                onClick={createTicket}
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black"
              >
                Create Ticket
              </button>

            </div>

          </div>

        </div>

      )}


    </main>

  );
}
