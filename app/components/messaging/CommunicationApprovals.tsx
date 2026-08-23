"use client";

export default function CommunicationApprovals({
  approvals,
}: {
  approvals: Array<{
    id: string;
    channel: string;
    recipient: string;
    message: string;
  }>;
}) {

  async function decide(
    id: string,
    decision: "approved" | "rejected",
  ) {

    await fetch(
      `/api/action-approvals/${id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision,
        }),
      },
    );

    window.location.reload();
  }


  return (
    <section className="mt-10">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
        AI Communication Approvals
      </p>


      <h2 className="mt-2 text-2xl font-black">
        Messages Waiting For Approval
      </h2>


      {approvals.length === 0 ? (

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white/40">
          No pending approvals.
        </div>

      ) : (

        <div className="mt-6 grid gap-5">

          {approvals.map((item) => (

            <div
              key={item.id}
              className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"
            >

              <div className="flex justify-between">

                <div>
                  <p className="text-cyan-300 text-sm font-bold uppercase">
                    {item.channel}
                  </p>

                  <h3 className="mt-2 font-black">
                    {item.recipient}
                  </h3>
                </div>

                <span className="text-xs text-white/40">
                  Pending
                </span>

              </div>


              <p className="mt-4 text-sm text-white/60">
                {item.message}
              </p>


              <div className="mt-5 flex gap-3">

                <button
                  onClick={() =>
                    decide(
                      item.id,
                      "approved",
                    )
                  }
                  className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-black"
                >
                  Approve
                </button>


                <button
                  onClick={() =>
                    decide(
                      item.id,
                      "rejected",
                    )
                  }
                  className="rounded-xl border border-white/20 px-4 py-2 text-xs font-bold"
                >
                  Reject
                </button>

              </div>

            </div>

          ))}

        </div>

      )}

    </section>
  );
}
