"use client";

import { useEffect, useState } from "react";
import SalesEmployeeChat from "../SalesEmployeeChat";

type WorkspaceTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueAt: number | null;
  createdAt: number;
};

type WorkspaceData = {
  activities: {
    id: string;
    title: string;
    description: string | null;
  }[];

  tasks: WorkspaceTask[];

  followUps: {
    id: string;
    title: string;
    description: string | null;
    dueAt: number;
    status: string;
  }[];

  pipeline: {
    id: string;
    stage: string;
  }[];
};

type Briefing = {
  greeting: string;
  recommendation: string;
  summary: {
    totalLeads: number;
    qualifiedLeads: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
  };
};

type SalesDocument = {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number | null;
  status: string;
  processingError: string | null;
  description: string | null;
  createdAt: string | number | Date;
};

type Props = {
  employeeId: string;
};

export default function SalesWorkspace({
  employeeId,
}: Props) {
  const [briefing, setBriefing] =
    useState<Briefing | null>(null);

  const [workspace, setWorkspace] =
    useState<WorkspaceData | null>(null);

  const [documents, setDocuments] =
    useState<SalesDocument[]>([]);

  const [plans, setPlans] =
    useState<Record<string, {
      nextAction: string;
      reason: string;
      customerMessage: string;
      confidence: string;
    }>>({});

  const [sending, setSending] =
    useState<string | null>(null);

  const [generatingPlan, setGeneratingPlan] =
    useState<string | null>(null);


  useEffect(() => {
    async function loadData() {
      const [
        briefingResponse,
        workspaceResponse,
        tasksResponse,
        documentsResponse,
      ] = await Promise.all([
        fetch("/api/ai/sales/briefing"),
        fetch("/api/ai/sales/workspace"),
        fetch(
          `/api/ai/employees/${employeeId}/tasks`,
        ),
        fetch(
          `/api/ai/employees/${employeeId}/documents`,
        ),
      ]);


      if (briefingResponse.ok) {
        setBriefing(
          await briefingResponse.json(),
        );
      }


      if (workspaceResponse.ok) {
        const workspaceData =
          await workspaceResponse.json();

        let taskData: {
          tasks: WorkspaceTask[];
        } = {
          tasks: [],
        };

        if (tasksResponse.ok) {
          taskData =
            await tasksResponse.json();
        }

        setWorkspace({
          ...workspaceData,
          tasks:
            taskData.tasks || [],
        });
      }

      if (documentsResponse.ok) {
        const documentData =
          await documentsResponse.json();

        setDocuments(
          documentData.documents || [],
        );
      }
    }

    loadData();
  }, [employeeId]);


  async function assignToKuba(id: string) {
    try {
      const response = await fetch(
        `/api/follow-ups/${id}/handle`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Unable to assign follow-up.",
        );
      }

      setWorkspace((current) => {
        if (!current) return current;

        return {
          ...current,
          followUps: current.followUps.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "assigned_to_ai",
                }
              : item,
          ),
        };
      });

    } catch (error) {
      console.error(
        "Kuba assignment error:",
        error,
      );
    }
  }


  async function generatePlan(id: string) {
    setGeneratingPlan(id);

    try {
      const response = await fetch(
        `/api/follow-ups/${id}/plan`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error(
          "Unable to generate plan.",
        );
      }

      const data = await response.json();

      setPlans((current) => ({
        ...current,
        [id]: data,
      }));

    } catch (error) {
      console.error(
        "Plan generation error:",
        error,
      );
    } finally {
      setGeneratingPlan(null);
    }
  }


  async function sendKubaMessage(
    id: string,
    message: string,
  ) {
    setSending(id);

    try {
      const response = await fetch(
        `/api/follow-ups/${id}/send`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Message failed",
        );
      }

      alert("Message sent successfully");

    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to send message",
      );
    } finally {
      setSending(null);
    }
  }


  async function completeFollowUp(id: string) {
    try {
      const response = await fetch(
        `/api/follow-ups/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "completed",
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          "Unable to complete follow-up.",
        );
      }

      setWorkspace((current) => {
        if (!current) return current;

        return {
          ...current,
          followUps: current.followUps.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: "completed",
                }
              : item,
          ),
        };
      });

    } catch (error) {
      console.error(
        "Complete follow-up error:",
        error,
      );
    }
  }


  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

      {/* CHAT */}
      <section>
        <SalesEmployeeChat employeeId={employeeId} />
      </section>


      {/* SALES COMMAND CENTER */}
      <aside className="space-y-5">


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <p className="text-xs uppercase tracking-wider text-white/40">
            Sales Intelligence
          </p>

          <h3 className="mt-3 font-bold">
            {briefing?.greeting ||
              "Preparing briefing..."}
          </h3>

          <p className="mt-3 text-sm text-white/40">
            {briefing?.recommendation ||
              "Analyzing opportunities."}
          </p>

        </section>


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <div className="flex items-center justify-between">

            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">
                Assigned Tasks
              </p>

              <p className="mt-1 text-xs text-white/25">
                Tasks assigned to Sales AI
              </p>
            </div>

            <span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-bold text-cyan-300">
              {workspace?.tasks?.length || 0}
            </span>

          </div>


          <div className="mt-4 space-y-3">

            {workspace?.tasks?.length ? (

              workspace.tasks.map((task) => (

                <div
                  key={task.id}
                  className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <p className="text-sm font-semibold text-white">
                        {task.title}
                      </p>

                      {task.description && (
                        <p className="mt-1 text-xs leading-5 text-white/40">
                          {task.description}
                        </p>
                      )}

                    </div>


                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        task.priority === "urgent"
                          ? "bg-red-400/10 text-red-300"
                          : task.priority === "high"
                            ? "bg-orange-400/10 text-orange-300"
                            : task.priority === "low"
                              ? "bg-white/[0.06] text-white/40"
                              : "bg-cyan-400/10 text-cyan-300"
                      }`}
                    >
                      {task.priority}
                    </span>

                  </div>


                  <div className="mt-3 flex items-center justify-between">

                    <span className="text-[11px] capitalize text-white/30">
                      {task.status.replaceAll("_", " ")}
                    </span>

                    {task.dueAt && (
                      <span className="text-[11px] text-white/30">
                        Due{" "}
                        {new Date(
                          task.dueAt,
                        ).toLocaleString()}
                      </span>
                    )}

                  </div>

                </div>

              ))

            ) : (

              <div className="rounded-xl border border-dashed border-white/10 px-4 py-5 text-center">

                <p className="text-sm text-white/40">
                  No tasks assigned.
                </p>

                <p className="mt-1 text-xs text-white/20">
                  Tasks assigned to Sales AI will appear here.
                </p>

              </div>

            )}

          </div>

        </section>


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <div className="flex items-center justify-between gap-3">

            <div>
              <p className="text-xs uppercase tracking-wider text-white/40">
                Sales Documents & Data
              </p>

              <p className="mt-1 text-xs text-white/25">
                Information available to Sales AI
              </p>
            </div>

            <label className="cursor-pointer rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-black hover:bg-cyan-300">

              Upload

              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.mov"
                onChange={async (event) => {
                  const file =
                    event.target.files?.[0];

                  if (!file) {
                    return;
                  }

                  const formData =
                    new FormData();

                  formData.append(
                    "file",
                    file,
                  );

                  formData.append(
                    "employeeId",
                    employeeId,
                  );

                  try {
                    const response =
                      await fetch(
                        "/api/ai/knowledge/upload",
                        {
                          method: "POST",
                          body: formData,
                        },
                      );

                    const data =
                      await response.json();

                    if (!response.ok) {
                      throw new Error(
                        data.error ||
                          "Unable to upload document.",
                      );
                    }

                    const documentsResponse =
                      await fetch(
                        `/api/ai/employees/${employeeId}/documents`,
                      );

                    if (
                      documentsResponse.ok
                    ) {
                      const documentData =
                        await documentsResponse.json();

                      setDocuments(
                        documentData.documents ||
                          [],
                      );
                    }

                  } catch (error) {
                    console.error(
                      "Sales document upload error:",
                      error,
                    );

                    alert(
                      error instanceof Error
                        ? error.message
                        : "Unable to upload document.",
                    );
                  }

                  event.target.value = "";
                }}
              />

            </label>

          </div>


          <div className="mt-4 space-y-3">

            {documents.length ? (

              documents.map((document) => (

                <div
                  key={document.id}
                  className="rounded-xl border border-white/[0.06] bg-black/20 p-3"
                >

                  <div className="flex items-start justify-between gap-3">

                    <div className="min-w-0">

                      <p className="truncate text-sm font-semibold">
                        {document.originalName}
                      </p>

                      <p className="mt-1 text-xs uppercase text-white/30">
                        {document.fileType}
                      </p>

                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase ${
                        document.status === "processed"
                          ? "bg-green-400/10 text-green-300"
                          : document.status === "failed"
                            ? "bg-red-400/10 text-red-300"
                            : "bg-yellow-400/10 text-yellow-300"
                      }`}
                    >
                      {document.status}
                    </span>

                  </div>


                  {document.processingError && (
                    <p className="mt-2 text-xs text-red-300/80">
                      {document.processingError}
                    </p>
                  )}

                  <p className="mt-2 text-[11px] text-white/25">
                    Added{" "}
                    {new Date(
                      document.createdAt,
                    ).toLocaleDateString()}
                  </p>

                </div>

              ))

            ) : (

              <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center">

                <p className="text-sm text-white/40">
                  No sales documents yet.
                </p>

                <p className="mt-1 text-xs text-white/20">
                  Upload sales reports, spreadsheets,
                  price lists or other sales information.
                </p>

              </div>

            )}

          </div>

        </section>


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <p className="text-xs uppercase text-white/40">
            Follow-ups
          </p>


          <div className="mt-4 space-y-3">

            {workspace?.followUps.length ? (

              workspace.followUps.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl bg-black/20 p-3"
                >
                  <p className="text-sm font-semibold">
                    {item.title}
                  </p>

                  <p className="mt-1 text-xs text-white/40">
                    {item.status}
                  </p>

                  <button
                    onClick={() =>
                      generatePlan(item.id)
                    }
                    disabled={generatingPlan === item.id}
                    className="mt-3 rounded-lg border border-cyan-400/30 px-3 py-1.5 text-xs font-bold text-cyan-300 disabled:opacity-50"
                  >
                    {generatingPlan === item.id
                      ? "Kuba is analyzing..."
                      : "Generate Kuba Plan"}
                  </button>

                  {plans[item.id] && (
                    <div className="mt-4 rounded-xl bg-white/[0.04] p-3">

                      <p className="text-xs font-bold uppercase text-white/40">
                        Kuba's Recommendation
                      </p>

                      <div className="mt-3 space-y-3 text-sm text-white/80">

                        <div>
                          <p className="text-xs font-bold uppercase text-white/40">
                            Next Action
                          </p>
                          <p className="mt-1">
                            {plans[item.id].nextAction}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-white/40">
                            Reason
                          </p>
                          <p className="mt-1">
                            {plans[item.id].reason}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-white/40">
                            Customer Message
                          </p>
                          <p className="mt-1 whitespace-pre-line">
                            {plans[item.id].customerMessage}
                          </p>

                          <button
                            onClick={() =>
                              sendKubaMessage(
                                item.id,
                                plans[item.id].customerMessage,
                              )
                            }
                            disabled={sending === item.id}
                            className="mt-3 rounded-lg bg-green-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                          >
                            {sending === item.id
                              ? "Sending..."
                              : "Send with Kuba"}
                          </button>

                        </div>

                        <div>
                          <p className="text-xs font-bold uppercase text-white/40">
                            Confidence
                          </p>
                          <p className="mt-1 capitalize">
                            {plans[item.id].confidence}
                          </p>
                        </div>

                      </div>

                    </div>
                  )}

                  {item.status !== "completed" && (
                    <div className="mt-3 flex gap-2">

                      <button
                        onClick={() =>
                          completeFollowUp(item.id)
                        }
                        className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black"
                      >
                        Complete
                      </button>

                      {item.status !== "assigned_to_ai" && (
                        <button
                          onClick={() =>
                            assignToKuba(item.id)
                          }
                          className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-bold text-white"
                        >
                          Let Kuba Handle
                        </button>
                      )}

                    </div>
                  )}
                </div>
              ))

            ) : (

              <p className="text-sm text-white/40">
                No pending follow-ups.
              </p>

            )}

          </div>

        </section>


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <p className="text-xs uppercase text-white/40">
            Recent Activity
          </p>


          <div className="mt-4 space-y-3">

            {workspace?.activities.length ? (

              workspace.activities.map((item) => (
                <div
                  key={item.id}
                  className="text-sm"
                >
                  <p className="font-semibold">
                    {item.title}
                  </p>

                  <p className="text-xs text-white/40">
                    {item.description}
                  </p>
                </div>
              ))

            ) : (

              <p className="text-sm text-white/40">
                No activity yet.
              </p>

            )}

          </div>

        </section>


        <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-5">

          <p className="text-xs uppercase text-white/40">
            Pipeline
          </p>

          <p className="mt-3 text-3xl font-black">
            {workspace?.pipeline.length || 0}
          </p>

          <p className="text-sm text-white/40">
            Active leads
          </p>

        </section>


      </aside>

    </div>
  );
}
