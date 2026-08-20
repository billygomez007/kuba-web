import Link from "next/link";

export default function DepartmentIntelligence() {
  const departments = [
    {
      name: "Sales",
      description:
        "Monitor revenue opportunities, leads, conversions, and customer engagement.",
      metric: "0 opportunities",
      employee: "Kuba Sales",
      link: "/sales",
      icon: "↗",
    },
    {
      name: "Customer Service",
      description:
        "Understand customer conversations, support requests, and satisfaction.",
      metric: "0 conversations",
      employee: "Kuba Receptionist",
      link: "/workforce",
      icon: "✦",
    },
    {
      name: "Finance",
      description:
        "Track financial workflows, records, invoices, and business performance.",
      metric: "Ready for deployment",
      employee: "Kuba Accountant",
      link: "/workforce",
      icon: "₵",
    },
    {
      name: "Operations",
      description:
        "Monitor workflows, appointments, and business processes.",
      metric: "Ready for deployment",
      employee: "Kuba Operations",
      link: "/workforce",
      icon: "◈",
    },
  ];

  return (
    <section className="mt-10">

      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
          Business Intelligence
        </p>

        <h2 className="mt-2 text-2xl font-black">
          Department Intelligence
        </h2>

        <p className="mt-2 text-sm text-white/40">
          Kuba connects your business departments and provides insights from every area.
        </p>
      </div>


      <div className="mt-6 grid gap-5 md:grid-cols-2">

        {departments.map((department) => (
          <Link
            key={department.name}
            href={department.link}
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:bg-white/[0.08]"
          >

            <div className="flex items-center justify-between">

              <span className="text-2xl text-cyan-300">
                {department.icon}
              </span>

              <span className="text-xs uppercase text-white/30">
                {department.metric}
              </span>

            </div>


            <h3 className="mt-5 text-xl font-black">
              {department.name}
            </h3>


            <p className="mt-2 text-sm text-white/40">
              {department.description}
            </p>


            <div className="mt-5 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/60">
              AI Employee: {department.employee}
            </div>

          </Link>
        ))}

      </div>

    </section>
  );
}
