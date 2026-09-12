export type SemanticStatus = "success" | "warning" | "danger" | "neutral" | "info";

const STATUS_CLASSES: Record<SemanticStatus, string> = {
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-danger/25 bg-danger/10 text-danger",
  neutral: "border-border-default bg-surface-subtle text-text-tertiary",
  info: "border-info/25 bg-info/10 text-info",
};

/**
 * Maps a domain-specific status string (ticket status, appointment status,
 * automation run status, etc.) to one of five semantic presentation states.
 * Add a domain's statuses here rather than inventing a new badge color
 * scheme per page — the audit found five independent, inconsistent badge
 * implementations, one of which had no color-coding at all.
 */
export function semanticStatusFor(rawStatus: string): SemanticStatus {
  const value = rawStatus.toLowerCase();
  if (["completed", "resolved", "confirmed", "active", "approved", "healthy", "sent", "delivered", "read"].includes(value)) return "success";
  if (["pending", "waiting", "waiting_customer", "waiting_internal", "in_progress", "scheduled", "needs attention", "executing", "running"].includes(value)) return "warning";
  if (["failed", "cancelled", "canceled", "rejected", "escalated", "requires improvement", "no_show", "expired"].includes(value)) return "danger";
  if (["open", "new"].includes(value)) return "info";
  return "neutral";
}

export default function StatusBadge({
  status,
  label,
  dot = false,
}: {
  /** Either pass a semantic status directly, or a raw domain status string
   * to be mapped via semanticStatusFor. */
  status: SemanticStatus | string;
  label?: string;
  dot?: boolean;
}) {
  const semantic: SemanticStatus = ["success", "warning", "danger", "neutral", "info"].includes(status)
    ? (status as SemanticStatus)
    : semanticStatusFor(status);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-micro font-bold uppercase tracking-wide ${STATUS_CLASSES[semantic]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label ?? status}
    </span>
  );
}
