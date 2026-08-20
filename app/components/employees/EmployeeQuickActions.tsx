"use client";

type Action = {
  title: string;
  description: string;
  prompt: string;
};

const actions: Action[] = [
  {
    title: "Find Hot Leads",
    description:
      "Identify the most valuable opportunities.",
    prompt:
      "Find my hottest leads and explain why they are priorities.",
  },
  {
    title: "Create Follow-ups",
    description:
      "Prepare follow-up actions for customers.",
    prompt:
      "Create a follow-up plan for my pending leads.",
  },
  {
    title: "Sales Plan",
    description:
      "Generate today's sales strategy.",
    prompt:
      "Prepare my sales plan for today.",
  },
  {
    title: "Analyze Pipeline",
    description:
      "Review sales performance.",
    prompt:
      "Analyze my sales pipeline and show risks.",
  },
];

export default function EmployeeQuickActions({
  onAction,
}: {
  onAction: (prompt: string) => void;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

      {actions.map((action) => (
        <button
          key={action.title}
          type="button"
          onClick={() =>
            onAction(action.prompt)
          }
          className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 text-left transition hover:bg-white/[0.07]"
        >

          <h3 className="font-bold text-white">
            {action.title}
          </h3>

          <p className="mt-2 text-sm leading-5 text-white/40">
            {action.description}
          </p>

        </button>
      ))}

    </section>
  );
}
