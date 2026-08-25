export type BusinessResource = { businessId: string };

export function onlySelectedBusiness<T extends BusinessResource>(
  rows: T[],
  selectedBusinessId: string,
): T[] {
  return rows.filter((row) => row.businessId === selectedBusinessId);
}

export function rejectBusinessOverride(
  body: Record<string, unknown>,
  selectedBusinessId: string,
): boolean {
  return typeof body.businessId === "string" && body.businessId !== selectedBusinessId;
}

export function buildOperationalMetrics(
  input: {
    tasks: Array<BusinessResource & { status: string; dueAt: Date | null }>;
    approvals: Array<BusinessResource & { status: string }>;
    automations: Array<BusinessResource & { status: string }>;
    runs: Array<BusinessResource & { status: string }>;
  },
  selectedBusinessId: string,
  now = new Date(),
) {
  const tasks = onlySelectedBusiness(input.tasks, selectedBusinessId);
  const approvals = onlySelectedBusiness(input.approvals, selectedBusinessId);
  const automations = onlySelectedBusiness(input.automations, selectedBusinessId);
  const runs = onlySelectedBusiness(input.runs, selectedBusinessId);
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const isOpen = (status: string) => !["completed", "cancelled"].includes(status);

  return {
    openTasks: tasks.filter((task) => isOpen(task.status)).length,
    tasksDueToday: tasks.filter((task) => task.dueAt && isOpen(task.status) && task.dueAt >= dayStart && task.dueAt < dayEnd).length,
    overdueTasks: tasks.filter((task) => task.dueAt && isOpen(task.status) && task.dueAt < now).length,
    pendingApprovals: approvals.filter((approval) => approval.status === "pending").length,
    activeAutomations: automations.filter((automation) => automation.status === "active").length,
    recentAutomationRuns: runs.length,
    failedAutomationRuns: runs.filter((run) => run.status === "failed").length,
  };
}
