import Link from "next/link";
import AIEmployeeStatusBadge from "./AIEmployeeStatusBadge";

type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
};

export default function AIEmployeeCard({
  employee,
}: {
  employee: Employee;
}) {
  return (
    <Link
      href={`/dashboard/employees/${employee.id}`}
      className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-0.5 hover:border-cyan-300/25 hover:bg-white/[0.06]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/[0.08] text-lg text-cyan-300">
          ✦
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-white/90">
            {employee.name}
          </p>
          <p className="mt-1 truncate text-xs capitalize text-white/35">
            {employee.type.replaceAll("-", " ")}
          </p>
        </div>
      </div>
      <AIEmployeeStatusBadge status={employee.status} />
    </Link>
  );
}
