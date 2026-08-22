"use client";

import EmptyState from "../EmptyState";

type Communication = {
  id: string;
  channel: string;
  recipient: string;
  status: string;
  message: string;
  provider?: string | null;
};

export default function CommunicationHistory({
  communications,
}: {
  communications: Communication[];
}) {

  return (
    <section className="mt-10">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        Communication History
      </p>


      <h2 className="mt-2 text-2xl font-black">
        Recent AI Communications
      </h2>


      {communications.length === 0 ? (

        <EmptyState
          icon="✦"
          title="AI-powered outreach will be tracked here"
          description="Once a channel is connected, SuperKuba records customer messages and follow-ups so your team has a complete communication history."
          actionLabel="Connect Integration"
          actionHref="/dashboard/integrations"
          className="mt-6"
          compact
        />

      ) : (

        <div className="mt-6 space-y-4">

          {communications.map((item) => (

            <div
              key={item.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >

              <div className="flex justify-between">

                <div>

                  <p className="text-cyan-300 text-xs font-bold uppercase">
                    {item.channel}
                  </p>


                  <h3 className="mt-2 font-black">
                    {item.recipient}
                  </h3>

                </div>


                <span className="text-xs text-white/40 uppercase">
                  {item.status}
                </span>

              </div>


              <p className="mt-4 text-sm text-white/60">
                {item.message}
              </p>


              {item.provider && (

                <p className="mt-3 text-xs text-white/30">
                  Provider: {item.provider}
                </p>

              )}

            </div>

          ))}

        </div>

      )}

    </section>
  );
}
