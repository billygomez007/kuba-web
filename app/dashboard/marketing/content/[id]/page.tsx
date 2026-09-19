"use client";

import { useEffect, useState } from "react";
import ContentOperations, {
  type ContentOperationsData,
} from "./ContentOperations";

export default function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<ContentOperationsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    params.then(({ id }) => {
      fetch(`/api/marketing/content/${id}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const body = await response.json();

          if (!response.ok) {
            throw new Error(body.error || "Unable to load content operations.");
          }

          if (!cancelled) {
            setData(body as ContentOperationsData);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to load content operations.",
            );
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [params]);

  if (error) {
    return (
      <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1450px]">
          <div className="rounded-card border border-border-default bg-surface-card p-6 text-danger">
            {error}
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1450px]">
          <div className="rounded-card border border-border-default bg-surface-card p-6 text-text-tertiary">
            Loading content operations…
          </div>
        </div>
      </main>
    );
  }

  return <ContentOperations data={data} />;
}
