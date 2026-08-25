import { notFound } from "next/navigation";
import WorkforceView, { type WorkforceSection } from "../WorkforceView";

const sections = new Set(["employees", "hr", "departments", "positions", "contracts", "documents", "attendance", "leave", "payroll", "teams"]);
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.has(section)) notFound();
  return <WorkforceView section={section as WorkforceSection} />;
}
