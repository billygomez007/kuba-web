export const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  running: "Running",
  paused: "Paused",
  completed: "Completed",
  stopped: "Stopped",
  failed: "Failed",
};

// StatusBadge's own raw-string mapping only recognizes a handful of
// statuses — pass an explicit semantic + label for the rest rather than
// relying on it to guess (see app/components/ui/StatusBadge.tsx).
export const CAMPAIGN_STATUS_SEMANTIC: Record<string, string> = {
  draft: "neutral",
  scheduled: "warning",
  running: "warning",
  paused: "neutral",
  completed: "success",
  stopped: "neutral",
  failed: "danger",
};

export const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  ready: "Ready",
  scheduled: "Scheduled",
  in_progress: "Sending",
  sent: "Sent",
  replied: "Replied",
  interested: "Interested",
  handed_off: "Handed off",
  completed: "Completed",
  suppressed: "Suppressed",
  opted_out: "Opted out",
  failed: "Failed",
  stopped: "Stopped",
};

export const RECIPIENT_STATUS_SEMANTIC: Record<string, string> = {
  pending: "neutral",
  ready: "neutral",
  scheduled: "warning",
  in_progress: "warning",
  sent: "success",
  replied: "info",
  interested: "info",
  handed_off: "success",
  completed: "success",
  suppressed: "danger",
  opted_out: "danger",
  failed: "danger",
  stopped: "neutral",
};

export function formatDate(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
