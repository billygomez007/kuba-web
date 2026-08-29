"use client";

import { cloneElement, isValidElement, useId, type ReactElement } from "react";

/**
 * Canonical form field wrapper. Guarantees real label/input association
 * (htmlFor + id) instead of the visually-adjacent-but-unassociated
 * <label><span>...</span><input/></label> pattern the audit found in
 * several customer-facing forms. Wraps exactly one input/select/textarea
 * element as its child.
 */
export default function FormField({
  label,
  description,
  error,
  required = false,
  children,
}: {
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: ReactElement<{ id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string; required?: boolean }>;
}) {
  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  const field = isValidElement(children)
    ? cloneElement(children, {
        id: inputId,
        required,
        "aria-invalid": Boolean(error),
        "aria-describedby": [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
      })
    : children;

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-sm font-semibold text-text-secondary">
        {label}
        {required && <span className="ml-1 text-danger">*</span>}
      </label>

      {field}

      {description && !error && (
        <p id={descriptionId} className="mt-1.5 text-caption text-text-muted">
          {description}
        </p>
      )}

      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-caption text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
