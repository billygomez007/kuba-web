"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Row = Record<string, unknown> & { id: string };
type WorkforceData = {
  access: { payroll: boolean; payrollMode: string };
  metrics: Record<string, number>;
  employees: Row[]; departments: Row[]; positions: Row[]; contracts: Row[];
  documents: Row[]; attendance: Row[]; corrections: Row[]; policies: Row[]; schedules: Row[];
  leaveTypes: Row[]; leaveBalances: Row[]; leaveRequests: Row[]; branches: Row[];
  teams: Array<Row & { humanMembers: Row[]; aiEmployees: Row[] }>;
  payroll: null | { periods: Row[]; runs: Row[]; compensationProfiles: Row[]; salaryStructures: Row[]; payslips: Row[]; jurisdictions: Row[] };
};

export type WorkforceSection = "overview" | "employees" | "hr" | "departments" | "positions" | "contracts" | "documents" | "attendance" | "leave" | "payroll" | "teams";

const nav: Array<[string, WorkforceSection]> = [["Overview", "overview"], ["Employees", "employees"], ["HR hub", "hr"], ["Departments", "departments"], ["Positions", "positions"], ["Contracts", "contracts"], ["Documents", "documents"], ["Attendance", "attendance"], ["Leave", "leave"], ["Payroll", "payroll"], ["Operational Teams", "teams"]];
const href = (section: WorkforceSection) => section === "overview" ? "/dashboard/human-workforce" : `/dashboard/human-workforce/${section}`;
const text = (value: unknown) => value === null || value === undefined || value === "" ? "—" : String(value).replaceAll("_", " ");
const date = (value: unknown) => value ? new Date(value as string).toLocaleDateString() : "—";

export default function WorkforceView({ section }: { section: WorkforceSection }) {
  const [data, setData] = useState<WorkforceData | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  useEffect(() => { void fetch("/api/human-workforce", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load workforce data.")); }, []);
  const employees = useMemo(() => (data?.employees ?? []).filter((employee) => {
    const haystack = `${employee.displayName} ${employee.employeeNumber} ${employee.workEmail}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) && (!status || employee.employmentStatus === status);
  }), [data, query, status]);
  const employeeName = (id: unknown) => text(data?.employees.find((employee) => employee.id === id)?.displayName);
  const departmentName = (id: unknown) => text(data?.departments.find((department) => department.id === id)?.name);
  const positionName = (id: unknown) => text(data?.positions.find((position) => position.id === id)?.title);
  const branchName = (id: unknown) => text(data?.branches.find((branch) => branch.id === id)?.name);

  return <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-7xl">
    <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Human Workforce</p>
    <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">{nav.find((item) => item[1] === section)?.[0]}</h1>
    <p className="mt-3 text-sm text-white/40">Authoritative records for the currently selected business.</p>
    <nav className="mt-7 flex gap-2 overflow-x-auto pb-2" aria-label="Human Workforce sections">{nav.map(([label, key]) => <Link key={key} href={href(key)} className={`whitespace-nowrap rounded-full border px-3 py-2 text-xs ${section === key ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 text-white/45"}`}>{label}</Link>)}</nav>
    {error && <div role="alert" className="mt-8 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</div>}
    {!error && !data && <p className="mt-10 text-white/40">Loading workforce records…</p>}
    {data && <div className="mt-8">{renderSection()}</div>}
  </div></main>;

  function renderSection() {
    if (!data) return null;
    if (section === "overview") return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(data.metrics).map(([key, value]) => <Metric key={key} label={key} value={value} />)}</div><Panel title="Workforce alerts"><div className="grid gap-3 sm:grid-cols-3"><Alert label="Pending leave requests" value={data.metrics.pendingLeaveRequests} href={href("leave")} /><Alert label="Contracts expiring in 30 days" value={data.metrics.contractsExpiringSoon} href={href("contracts")} /><Alert label="Attendance corrections" value={data.corrections.filter((row) => row.status === "pending").length} href={href("attendance")} /></div></Panel></>;
    if (section === "employees") return <><div className="grid gap-3 sm:grid-cols-[1fr_220px]"><input aria-label="Search employees" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, number or work email" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none" /><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-white/10 bg-[#101014] px-4 py-3 text-sm"><option value="">All statuses</option>{Array.from(new Set(data.employees.map((row) => String(row.employmentStatus)))).map((value) => <option key={value}>{value}</option>)}</select></div><Table headers={["Employee", "Number", "Status", "Department", "Position", "Branch", "Hire date"]} rows={employees.map((row) => [text(row.displayName), text(row.employeeNumber), text(row.employmentStatus), departmentName(row.departmentId), positionName(row.positionId), branchName(row.branchId), date(row.hireDate)])} empty="No employees match these filters." /></>;
    if (section === "hr") return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{nav.slice(3, 9).map(([label, key]) => <Link key={key} href={href(key)} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 hover:border-cyan-300/25"><h2 className="font-bold">{label}</h2><p className="mt-2 text-sm text-white/35">Open authoritative {label.toLowerCase()} records.</p></Link>)}{["Performance", "Recruitment"].map((label) => <div key={label} className="rounded-3xl border border-dashed border-white/10 p-6"><h2 className="font-bold text-white/55">{label}</h2><p className="mt-2 text-xs uppercase tracking-wider text-white/25">Coming Soon · backend required</p></div>)}</div>;
    if (section === "departments") return <Table headers={["Department", "Code", "Manager", "Employees", "Status"]} rows={data.departments.map((row) => [text(row.name), text(row.code), employeeName(row.managerEmployeeId), data.employees.filter((item) => item.departmentId === row.id).length, text(row.status)])} empty="No departments configured." />;
    if (section === "positions") return <Table headers={["Position", "Code", "Department", "Occupancy", "Limit", "Status"]} rows={data.positions.map((row) => [text(row.title), text(row.code), departmentName(row.departmentId), data.employees.filter((item) => item.positionId === row.id).length, text(row.headcountLimit), text(row.status)])} empty="No positions configured." />;
    if (section === "contracts") return <Table headers={["Employee", "Contract", "Type", "Position", "Start", "End", "Status"]} rows={data.contracts.map((row) => [employeeName(row.employeeId), text(row.contractNumber), text(row.contractType), positionName(row.positionId), date(row.startDate), date(row.endDate), text(row.status)])} empty="No contracts recorded." />;
    if (section === "documents") return <><Notice>Employee Documents are restricted HR records and remain separate from Business Brain knowledge.</Notice><Table headers={["Employee", "Title", "Type", "File", "Expiry", "Status"]} rows={data.documents.map((row) => [employeeName(row.employeeId), text(row.title), text(row.documentType), text(row.fileName), date(row.expiresAt), text(row.status)])} empty="No employee documents recorded." /></>;
    if (section === "attendance") return <><div className="grid gap-4 sm:grid-cols-3"><Metric label="Today records" value={data.attendance.length} /><Metric label="Late today" value={data.attendance.filter((row) => Number(row.lateMinutes) > 0).length} /><Metric label="Pending corrections" value={data.corrections.filter((row) => row.status === "pending").length} /></div><Table headers={["Employee", "Date", "Status", "Clock in", "Clock out", "Late minutes"]} rows={data.attendance.map((row) => [employeeName(row.employeeId), date(row.workDate), text(row.status), text(row.clockInAt), text(row.clockOutAt), text(row.lateMinutes)])} empty="No attendance records for today." /></>;
    if (section === "leave") return <><div className="grid gap-4 sm:grid-cols-3"><Metric label="Leave types" value={data.leaveTypes.length} /><Metric label="Balances" value={data.leaveBalances.length} /><Metric label="Pending requests" value={data.metrics.pendingLeaveRequests} /></div><Table headers={["Employee", "Leave type", "Start", "End", "Minutes", "Status"]} rows={data.leaveRequests.map((row) => [employeeName(row.employeeId), text(data.leaveTypes.find((item) => item.id === row.leaveTypeId)?.name), date(row.startDate), date(row.endDate), text(row.requestedMinutes), text(row.status)])} empty="No leave requests recorded." /><Notice>Request, approval, rejection, and cancellation remain unavailable until an authoritative approval service is connected.</Notice></>;
    if (section === "teams") return <div className="grid gap-4 lg:grid-cols-2">{data.teams.length ? data.teams.map((team) => <article key={team.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wider text-cyan-200/60">{text(team.department)}</p><h2 className="mt-1 text-xl font-black">{text(team.name)}</h2></div><Badge value={text(team.status)} /></div><p className="mt-3 text-sm text-white/40">{text(team.description)}</p><div className="mt-5 grid grid-cols-2 gap-4 text-sm"><div><p className="text-xs text-white/30">Human members</p><p className="mt-1 font-bold">{team.humanMembers.length}</p></div><div><p className="text-xs text-white/30">AI employees</p><p className="mt-1 font-bold">{team.aiEmployees.length}</p></div></div></article>) : <Empty text="No operational teams configured." />}</div>;
    if (!data.access.payroll || !data.payroll) return <Notice>Payroll access is restricted to established accounting-authorized owner, admin, and accountant roles.</Notice>;
    return <><Notice>Payroll is read-only. The repository contains data models but no authoritative calculation, statutory, approval, finalization, or payment engine.</Notice><div className="grid gap-4 sm:grid-cols-3"><Metric label="Pay periods" value={data.payroll.periods.length} /><Metric label="Payroll runs" value={data.payroll.runs.length} /><Metric label="Payslips" value={data.payroll.payslips.length} /></div><Table headers={["Period", "Dates", "Payment date", "Status"]} rows={data.payroll.periods.map((row) => [text(row.name), `${date(row.startDate)} – ${date(row.endDate)}`, date(row.paymentDate), text(row.status)])} empty="No pay periods configured." /><Table headers={["Run", "Currency", "Employees", "Status"]} rows={data.payroll.runs.map((row) => [`#${text(row.runNumber)}`, text(row.currencyCode), text(row.employeeCount), text(row.status)])} empty="No payroll runs recorded." /></>;
  }
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">{label.replace(/([A-Z])/g, " $1")}</p><p className="mt-3 text-3xl font-black text-cyan-100">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.02] p-6"><h2 className="text-xl font-black">{title}</h2><div className="mt-5">{children}</div></section>; }
function Alert({ label, value, href: target }: { label: string; value: number; href: string }) { return <Link href={target} className="rounded-2xl border border-white/[0.07] p-4"><p className="text-sm text-white/55">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></Link>; }
function Notice({ children }: { children: React.ReactNode }) { return <div className="mb-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-4 text-sm text-amber-100/65">{children}</div>; }
function Badge({ value }: { value: string }) { return <span className="h-fit rounded-full border border-emerald-400/20 px-2.5 py-1 text-[9px] font-bold uppercase text-emerald-300">{value}</span>; }
function Empty({ text: value }: { text: string }) { return <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">{value}</p>; }
function Table({ headers, rows, empty }: { headers: string[]; rows: Array<Array<React.ReactNode>>; empty: string }) { return <div className="mt-6 overflow-x-auto rounded-3xl border border-white/10"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-white/[0.04] text-[10px] uppercase tracking-wider text-white/35"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-t border-white/[0.07]">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-white/65 first:font-semibold first:text-white">{cell}</td>)}</tr>)}</tbody></table>{!rows.length && <Empty text={empty} />}</div>; }

