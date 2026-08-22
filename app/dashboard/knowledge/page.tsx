"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import EmptyState from "../../components/EmptyState";


type KnowledgeForm = {
  businessDescription: string;
  productsAndServices: string;
  targetCustomers: string;
  frequentlyAskedQuestions: string;
  aiInstructions: string;
  tone: string;
};


type KnowledgeSource = {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  mimeType: string | null;
  fileSize: number | null;
  status: string;
  processingError: string | null;
  createdAt: string;
};


const initialForm: KnowledgeForm = {
  businessDescription: "",
  productsAndServices: "",
  targetCustomers: "",
  frequentlyAskedQuestions: "",
  aiInstructions: "",
  tone: "professional",
};


const acceptedFiles = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".mp4",
  ".webm",
  ".mov",
];


export default function KnowledgePage() {
  const [form, setForm] =
    useState<KnowledgeForm>(initialForm);

  const [sources, setSources] =
    useState<KnowledgeSource[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [deletingSource, setDeletingSource] =
    useState<string | null>(null);

  const [retryingSource, setRetryingSource] =
    useState<string | null>(null);

  const [dragging, setDragging] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);


  useEffect(() => {
    loadKnowledge();
    loadSources();
  }, []);


  async function loadKnowledge() {
    try {
      const response =
        await fetch("/api/ai/knowledge");

      const data =
        await response.json();

      if (
        response.ok &&
        data.knowledge
      ) {
        setForm({
          businessDescription:
            data.knowledge.businessDescription || "",

          productsAndServices:
            data.knowledge.productsAndServices || "",

          targetCustomers:
            data.knowledge.targetCustomers || "",

          frequentlyAskedQuestions:
            data.knowledge.frequentlyAskedQuestions || "",

          aiInstructions:
            data.knowledge.aiInstructions || "",

          tone:
            data.knowledge.tone ||
            "professional",
        });
      }

    } catch {
      setMessage(
        "Unable to load business knowledge.",
      );
    }
  }


  async function loadSources() {
    try {
      const response =
        await fetch(
          "/api/ai/knowledge/sources",
        );

      const data =
        await response.json();

      if (response.ok) {
        setSources(
          data.sources || [],
        );
      }

    } catch {
      setMessage(
        "Unable to load knowledge sources.",
      );
    } finally {
      setLoading(false);
    }
  }


  function updateField(
    field: keyof KnowledgeForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }


  async function deleteSource(sourceId: string) {
    if (deletingSource || retryingSource) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this knowledge source? Its stored file and processed knowledge will also be removed.",
    );

    if (!confirmed) {
      return;
    }

    setDeletingSource(sourceId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai/knowledge/sources",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete knowledge source.",
        );
      }

      setSources((current) =>
        current.filter(
          (source) =>
            source.id !== sourceId,
        ),
      );

      setMessage(
        "Knowledge source deleted.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete knowledge source.",
      );
    } finally {
      setDeletingSource(null);
    }
  }


  async function retrySource(sourceId: string) {
    if (deletingSource || retryingSource) {
      return;
    }

    setRetryingSource(sourceId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/ai/knowledge/sources/retry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceId,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to retry knowledge processing.",
        );
      }

      await loadSources();

      setMessage(
        data.chunks
          ? `Knowledge source processed successfully. ${data.chunks} knowledge chunks created.`
          : "Knowledge source processing restarted.",
      );
    } catch (error) {
      await loadSources();

      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to retry knowledge processing.",
      );
    } finally {
      setRetryingSource(null);
    }
  }


  async function saveKnowledge() {
    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/ai/knowledge",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(form),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to save knowledge.",
        );
      }

      setMessage(
        "Business knowledge saved successfully.",
      );

    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save knowledge.",
      );
    } finally {
      setSaving(false);
    }
  }


  async function uploadFiles(
    files: FileList | File[],
  ) {
    if (!files.length || uploading) {
      return;
    }

    setUploading(true);
    setMessage("");

    let uploaded = 0;
    let failed = 0;

    try {
      for (const file of Array.from(files)) {
        const formData =
          new FormData();

        formData.append(
          "file",
          file,
        );

        const response =
          await fetch(
            "/api/ai/knowledge/upload",
            {
              method: "POST",
              body: formData,
            },
          );

        if (response.ok) {
          uploaded++;
        } else {
          failed++;
        }
      }

      await loadSources();

      if (failed === 0) {
        setMessage(
          `${uploaded} knowledge ${
            uploaded === 1
              ? "source"
              : "sources"
          } uploaded successfully.`,
        );
      } else {
        setMessage(
          `${uploaded} uploaded, ${failed} failed.`,
        );
      }

    } catch {
      setMessage(
        "Something went wrong while uploading.",
      );
    } finally {
      setUploading(false);
    }
  }


  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    if (event.target.files) {
      void uploadFiles(
        event.target.files,
      );
    }

    event.target.value = "";
  }


  function handleDrop(
    event: React.DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault();
    setDragging(false);

    if (event.dataTransfer.files) {
      void uploadFiles(
        event.dataTransfer.files,
      );
    }
  }


  function formatFileSize(
    bytes: number | null,
  ) {
    if (!bytes) {
      return "Unknown size";
    }

    if (bytes < 1024 * 1024) {
      return `${Math.round(
        bytes / 1024,
      )} KB`;
    }

    return `${(
      bytes /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }


  function getSourceIcon(
    type: string,
  ) {
    const icons: Record<
      string,
      string
    > = {
      pdf: "📄",
      word: "📝",
      excel: "📊",
      csv: "📋",
      text: "📃",
      image: "🖼️",
      video: "🎥",
    };

    return (
      icons[type] || "📁"
    );
  }


  function getStatusLabel(
    status: string,
  ) {
    if (status === "ready") {
      return "Ready";
    }

    if (status === "failed") {
      return "Failed";
    }

    if (status === "processing") {
      return "Processing";
    }

    return status;
  }


  if (loading) {
    return (
      <main className="min-h-screen bg-[#050505] text-white">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-sm text-white/35">
            Loading Knowledge Workspace...
          </p>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#050505] text-white">

      <div className="mx-auto max-w-6xl px-6 py-10 lg:px-8">

        {/* Header */}
        <header className="max-w-3xl">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.06] text-lg">
              ✦
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/60">
                Kuba Knowledge
              </p>

              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                Knowledge Workspace
              </h1>
            </div>

          </div>

          <p className="mt-5 text-sm leading-7 text-white/40">
            Teach Kuba how your business works.
            Everything you add here can become
            shared business knowledge for your AI
            workforce.
          </p>

        </header>


        {/* Knowledge status */}
        <section className="mt-8 rounded-3xl border border-cyan-400/10 bg-cyan-400/[0.025] p-5">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/[0.08]">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
              </span>

              <div>
                <p className="text-sm font-bold">
                  Knowledge base active
                </p>

                <p className="mt-1 text-xs text-white/30">
                  {sources.length} knowledge{" "}
                  {sources.length === 1
                    ? "source"
                    : "sources"}{" "}
                  available to your business.
                </p>
              </div>

            </div>

            <div className="text-xs text-white/25">
              Shared across your AI workforce
            </div>

          </div>

        </section>


        {/* Business Knowledge */}
        <section className="mt-12">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              Structured knowledge
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Teach Kuba about your business
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
              These details form the core business
              context used by your AI employees.
            </p>
          </div>


          <div className="mt-6 grid gap-5 lg:grid-cols-2">

            <KnowledgeField
              label="Business Description"
              description="What does your business do?"
              value={
                form.businessDescription
              }
              onChange={(value) =>
                updateField(
                  "businessDescription",
                  value,
                )
              }
              rows={7}
            />


            <KnowledgeField
              label="Products & Services"
              description="What does your business sell or provide?"
              value={
                form.productsAndServices
              }
              onChange={(value) =>
                updateField(
                  "productsAndServices",
                  value,
                )
              }
              rows={7}
            />


            <KnowledgeField
              label="Target Customers"
              description="Who does your business serve?"
              value={
                form.targetCustomers
              }
              onChange={(value) =>
                updateField(
                  "targetCustomers",
                  value,
                )
              }
              rows={6}
            />


            <KnowledgeField
              label="Frequently Asked Questions"
              description="Common customer questions and answers."
              value={
                form.frequentlyAskedQuestions
              }
              onChange={(value) =>
                updateField(
                  "frequentlyAskedQuestions",
                  value,
                )
              }
              rows={6}
            />

          </div>

        </section>


        {/* AI Behavior */}
        <section className="mt-12">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              AI behavior
            </p>

            <h2 className="mt-2 text-2xl font-black">
              How should Kuba behave?
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
              Give Kuba additional instructions about
              how your AI workforce should communicate
              and operate.
            </p>
          </div>


          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <div className="grid gap-6 lg:grid-cols-[240px_1fr]">

              <div>

                <label className="text-sm font-bold">
                  Communication tone
                </label>

                <p className="mt-2 text-xs leading-5 text-white/30">
                  Choose the general communication
                  style for your AI employees.
                </p>

                <select
                  value={form.tone}
                  onChange={(event) =>
                    updateField(
                      "tone",
                      event.target.value,
                    )
                  }
                  className="mt-4 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/30"
                >
                  <option value="professional">
                    Professional
                  </option>

                  <option value="friendly">
                    Friendly
                  </option>

                  <option value="sales">
                    Sales focused
                  </option>

                </select>

              </div>


              <KnowledgeField
                label="Additional AI Instructions"
                description="Rules, preferences, escalation instructions, or anything else Kuba should know."
                value={
                  form.aiInstructions
                }
                onChange={(value) =>
                  updateField(
                    "aiInstructions",
                    value,
                  )
                }
                rows={7}
              />

            </div>

          </div>


          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="text-sm text-white/35">
              {message || "Your knowledge stays connected to your business."}
            </div>

            <button
              type="button"
              onClick={saveKnowledge}
              disabled={saving}
              className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : "Save Knowledge"}
            </button>

          </div>

        </section>


        {/* Knowledge Sources */}
        <section className="mt-14">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
                Knowledge sources
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Give Kuba your documents
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
                Upload company documents, price lists,
                manuals, brochures, spreadsheets,
                images, training material, and other
                business knowledge.
              </p>

            </div>

            <div className="text-xs text-white/25">
              Maximum file size: 100 MB
            </div>

          </div>


          {/* Upload area */}
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() =>
              setDragging(false)
            }
            onDrop={handleDrop}
            className={`mt-6 rounded-3xl border border-dashed p-8 text-center transition sm:p-12 ${
              dragging
                ? "border-cyan-400/50 bg-cyan-400/[0.06]"
                : "border-white/10 bg-white/[0.02] hover:border-cyan-400/25 hover:bg-white/[0.03]"
            }`}
          >

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/15 bg-cyan-400/[0.05] text-2xl">
              ↑
            </div>

            <h3 className="mt-5 text-lg font-bold">
              {uploading
                ? "Uploading knowledge..."
                : "Upload knowledge"}
            </h3>

            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-white/35">
              Drag and drop your files here, or
              choose files from your computer.
            </p>

            <button
              type="button"
              disabled={uploading}
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="mt-6 rounded-xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-bold transition hover:bg-white/[0.1] disabled:opacity-40"
            >
              {uploading
                ? "Uploading..."
                : "Choose files"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptedFiles.join(",")}
              onChange={handleFileChange}
              className="hidden"
            />

            <p className="mt-5 text-[11px] leading-5 text-white/20">
              PDF · Word · Excel · CSV · Text · Images · Video
            </p>

          </div>


          {/* Sources */}
          <div className="mt-8">

            {sources.length === 0 ? (
              <EmptyState
                icon="✦"
                title="Teach your AI workforce about your business"
                description="Add trusted documents so your AI employees can answer accurately using your products, policies, and operating knowledge."
                actionLabel="Add Knowledge"
                onAction={() => fileInputRef.current?.click()}
              />

            ) : (

              <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">

                {sources.map(
                  (source, index) => (

                    <div
                      key={source.id}
                      className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between ${
                        index > 0
                          ? "border-t border-white/10"
                          : ""
                      }`}
                    >

                      <div className="flex min-w-0 items-center gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-lg">
                          {getSourceIcon(
                            source.fileType,
                          )}
                        </div>

                        <div className="min-w-0">

                          <p className="truncate text-sm font-bold">
                            {source.originalName}
                          </p>

                          <p className="mt-1 text-xs text-white/25">
                            {source.fileType.toUpperCase()}
                            {" · "}
                            {formatFileSize(
                              source.fileSize,
                            )}
                          </p>

                        </div>

                      </div>


                      <div className="flex flex-wrap items-center gap-2">

                        <span
                          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                            source.status ===
                            "ready"
                              ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                              : source.status ===
                                "failed"
                              ? "border-red-400/15 bg-red-400/[0.05] text-red-300"
                              : "border-amber-400/15 bg-amber-400/[0.05] text-amber-300"
                          }`}
                        >
                          {getStatusLabel(
                            source.status,
                          )}
                        </span>

                        {source.status ===
                          "failed" && (
                          <button
                            type="button"
                            disabled={
                              retryingSource ===
                                source.id ||
                              deletingSource !==
                                null
                            }
                            onClick={() =>
                              retrySource(
                                source.id,
                              )
                            }
                            className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400/[0.1] disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {retryingSource ===
                            source.id
                              ? "Retrying..."
                              : "Retry"}
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={
                            deletingSource ===
                              source.id ||
                            retryingSource !==
                              null
                          }
                          onClick={() =>
                            deleteSource(
                              source.id,
                            )
                          }
                          className="rounded-xl border border-red-400/10 bg-red-400/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-300/70 transition hover:border-red-400/20 hover:bg-red-400/[0.08] hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deletingSource ===
                          source.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>

                      </div>

                    </div>

                  ),
                )}

              </div>

            )}

          </div>

        </section>


        {/* Knowledge architecture */}
        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:p-8">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/60">
            Your AI workforce
          </p>

          <h2 className="mt-3 text-2xl font-black">
            One business knowledge base. Many AI employees.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/35">
            You teach Kuba about the business once.
            The appropriate knowledge can then be used
            by your Receptionist, Sales employee,
            General Manager, Support employee, and
            the rest of your AI workforce.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">

            {[
              "Receptionist",
              "Sales",
              "General Manager",
              "Customer Support",
              "Marketing",
              "Operations",
            ].map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/40"
              >
                {role}
              </span>
            ))}

          </div>

        </section>

      </div>

    </main>
  );
}


function KnowledgeField({
  label,
  description,
  value,
  onChange,
  rows,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

      <label className="text-sm font-bold">
        {label}
      </label>

      <p className="mt-2 text-xs leading-5 text-white/30">
        {description}
      </p>

      <textarea
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
        rows={rows}
        className="mt-5 w-full resize-y rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-white/20 focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
        placeholder={`Enter ${label.toLowerCase()}...`}
      />

    </div>
  );
}
