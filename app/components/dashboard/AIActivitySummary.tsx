type Activity = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string | number | Date;
};

export default function AIActivitySummary({
  activities,
}: {
  activities: Activity[];
}) {
  return (
    <div className="space-y-3">
      {activities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/35">
          Activity will appear as your AI employees complete work.
        </div>
      ) : (
        activities.slice(0, 4).map((activity) => (
          <div
            key={activity.id}
            className="flex gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
          >
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 shadow-lg shadow-cyan-300/30" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/80">{activity.title}</p>
              {activity.description && (
                <p className="mt-1 text-xs leading-5 text-white/35">
                  {activity.description}
                </p>
              )}
              <p className="mt-2 text-[10px] uppercase tracking-wider text-white/25">
                {activity.status}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
