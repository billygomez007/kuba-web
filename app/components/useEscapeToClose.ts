"use client";

import { useEffect } from "react";

/**
 * Closes a modal/dialog on Escape. Shared by the dashboard's modal
 * implementations instead of each one duplicating its own keydown
 * listener (or, previously, having none at all).
 */
export function useEscapeToClose(onClose: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);
}
