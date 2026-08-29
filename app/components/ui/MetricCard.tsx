import Link from "next/link";
import type { ReactNode } from "react";
import Card from "./Card";

/**
 * Canonical metric/stat card. Consolidates the 3+ independent
 * implementations the audit found (Command Center, Analytics, Customers,
 * Business Operations each had their own radius/opacity/label-casing/
 * value-color choices).
 */
export default function MetricCard({
  label,
  value,
  description,
  trend,
  icon,
  href,
  status,
}: {
  label: string;
  value: string | number;
  description?: string;
  /** e.g. "+12% this week" — purely descriptive text, not a fabricated number. */
  trend?: string;
  icon?: ReactNode;
  href?: string;
  status?: "success" | "warning" | "danger";
}) {
  const valueColor =
    status === "success" ? "text-success" : status === "warning" ? "text-warning" : status === "danger" ? "text-danger" : "text-text-primary";

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-label font-bold uppercase tracking-wide text-text-tertiary">{label}</p>
        {icon && <span className="text-text-tertiary">{icon}</span>}
      </div>
      <p className={`mt-3 text-h2 ${valueColor}`}>{value}</p>
      {description && <p className="mt-2 text-caption text-text-muted">{description}</p>}
      {trend && <p className="mt-2 text-micro text-text-tertiary">{trend}</p>}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-card border border-border-default bg-surface-card p-5 transition hover:border-accent/25 hover:bg-surface-card-hover">
        {content}
      </Link>
    );
  }

  return (
    <Card variant="standard" padding="sm" className="p-5">
      {content}
    </Card>
  );
}
