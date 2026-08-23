type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
};

export default function ExecutiveOperationsOverview({
  initialEmployees,
}: {
  initialEmployees: Employee[];
}) {
  const activeCount = initialEmployees.filter(
    (employee) => employee.status.toLowerCase() === "active",
  ).length;

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/30">AI workforce</p>
        <p className="mt-3 text-3xl font-black">{activeCount}</p>
        <p className="mt-1 text-xs text-white/35">Active employees</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/30">Operations</p>
        <p className="mt-3 text-3xl font-black text-emerald-300">Live</p>
        <p className="mt-1 text-xs text-white/35">Command center status</p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
        <p className="text-xs uppercase tracking-[0.18em] text-white/30">Coverage</p>
        <p className="mt-3 text-3xl font-black">{initialEmployees.length}</p>
        <p className="mt-1 text-xs text-white/35">Configured employees</p>
      </div>
    </section>
  );
}
