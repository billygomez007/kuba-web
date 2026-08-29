"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { useEscapeToClose } from "../useEscapeToClose";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Canonical accessible dialog/modal. Consolidates the 5 independent
 * hand-built modals the audit found (different overlay opacity, z-index,
 * radius, theme, and none with role="dialog"/aria-modal/focus
 * management/Escape/a labeled close button).
 */
export default function Dialog({
  title,
  description,
  onClose,
  children,
  size = "md",
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEscapeToClose(onClose);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusable = container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? container)?.focus();

    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  const maxWidth = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" }[size];

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`w-full ${maxWidth} rounded-panel border border-border-default bg-surface-raised p-6 shadow-dialog sm:p-8`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-h2">
              {title}
            </h2>
            {description && <p className="mt-2 text-sm text-text-muted">{description}</p>}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control border border-border-default bg-surface-subtle text-text-tertiary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          >
            ×
          </button>
        </div>

        <div className="mt-7">{children}</div>
      </div>
    </div>
  );
}
