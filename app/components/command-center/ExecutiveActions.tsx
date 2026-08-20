"use client";

export default function ExecutiveActions() {

  const actions = [
    {
      title: "Sales needs attention",
      description:
        "Review qualified opportunities and follow up with important leads.",
      button:
        "Open Sales",
      link:
        "/sales",
      icon:
        "↗",
    },

    {
      title: "Customer conversations",
      description:
        "Review customer requests and conversations handled by Kuba.",
      button:
        "Open Customers",
      link:
        "/customers",
      icon:
        "✦",
    },

    {
      title: "Manage AI Workforce",
      description:
        "Activate, configure, and monitor your AI employees.",
      button:
        "View Workforce",
      link:
        "/workforce",
      icon:
        "◎",
    },
  ];


  return (

    <section className="mt-10">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        Executive Actions
      </p>


      <h2 className="mt-2 text-2xl font-black">
        Recommended Actions
      </h2>


      <div className="mt-6 grid gap-5 md:grid-cols-3">

        {actions.map((action) => (

          <div
            key={action.title}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
          >

            <div className="text-2xl text-cyan-300">
              {action.icon}
            </div>


            <h3 className="mt-5 font-black">
              {action.title}
            </h3>


            <p className="mt-2 text-sm text-white/40">
              {action.description}
            </p>


            <a
              href={action.link}
              className="mt-5 inline-flex rounded-xl bg-white px-4 py-2 text-xs font-bold text-black"
            >
              {action.button}
            </a>

          </div>

        ))}

      </div>

    </section>

  );
}
