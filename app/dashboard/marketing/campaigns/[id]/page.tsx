"use client";

import { useEffect, useState } from "react";
import CampaignOperations, {
  type CampaignOperationsData,
} from "./CampaignOperations";

export default function MarketingCampaignDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [data, setData] = useState<CampaignOperationsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    params.then(({ id }) => {
      fetch(`/api/marketing/campaigns/${id}`, {
        cache: "no-store",
      })
        .then(async (response) => {
          const body = await response.json();

          if (!response.ok) {
            throw new Error(body.error || "Unable to load campaign operations.");
          }

          if (!cancelled) {
            setData(body as CampaignOperationsData);
          }
        })
        .catch((cause) => {
          if (!cancelled) {
            setError(
              cause instanceof Error
                ? cause.message
                : "Unable to load campaign operations.",
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
            Loading campaign operations…
          </div>
        </div>
      </main>
    );
  }

  return <CampaignOperations data={data} />;
}
