export default function WidgetsPage() {
  return (
    <main className="min-h-screen bg-[#07070A] px-6 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
          Kuba Website Integration
        </p>

        <h1 className="mt-3 text-3xl font-black">
          Website Widgets
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
          Connect Kuba AI employees to your website and allow visitors
          to chat, ask questions, and become customers automatically.
        </p>


        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-8">

          <h2 className="text-xl font-bold">
            No Website Widgets Yet
          </h2>

          <p className="mt-3 text-sm text-white/40">
            Create your first Kuba AI website assistant.
          </p>


          <button
            className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black"
          >
            Create Website Widget
          </button>


        </section>


      </div>

    </main>
  );
}
