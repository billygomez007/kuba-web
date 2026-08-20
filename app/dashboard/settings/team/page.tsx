"use client";

import { useEffect, useState } from "react";
import {
  ROLE_LABELS,
} from "@/lib/auth/roles";

type StaffMember = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: string;
  permissions: string | null;
  branchId: string | null;
  createdAt: string | null;
};

type Invitation = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  branchId: string | null;
  expiresAt: string | null;
  createdAt: string | null;
};


type BusinessTeam = {
  id: string;
  businessId: string;
  department: string;
  name: string;
  description: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};


type AIEmployee = {
  id: string;
  name: string;
  type: string;
  status: string;
};

const roles = [
  "admin",
  "manager",
  "sales",
  "accountant",
  "receptionist",
  "member",
];

const permissionGroups = [
  {
    label: "Dashboard",
    permissions: ["dashboard.view"],
  },
  {
    label: "Customers",
    permissions: [
      "customers.view",
      "customers.manage",
    ],
  },
  {
    label: "Sales",
    permissions: [
      "sales.view",
      "sales.manage",
      "sales.ai",
    ],
  },
  {
    label: "Accounting",
    permissions: [
      "accounting.view",
      "accounting.manage",
      "accounting.ai",
    ],
  },
  {
    label: "Reception",
    permissions: [
      "reception.view",
      "reception.manage",
      "reception.ai",
    ],
  },
  {
    label: "Analytics",
    permissions: [
      "analytics.view",
    ],
  },
  {
    label: "Tasks",
    permissions: [
      "tasks.view",
      "tasks.manage",
    ],
  },
  {
    label: "Follow-ups",
    permissions: [
      "followups.view",
      "followups.manage",
    ],
  },
  {
    label: "Knowledge",
    permissions: [
      "knowledge.view",
      "knowledge.manage",
    ],
  },
  {
    label: "Workforce",
    permissions: [
      "workforce.view",
      "workforce.manage",
    ],
  },
  {
    label: "Automations",
    permissions: [
      "automations.view",
      "automations.manage",
    ],
  },
  {
    label: "Messaging",
    permissions: [
      "messaging.view",
      "messaging.manage",
    ],
  },
  {
    label: "Integrations",
    permissions: [
      "integrations.view",
      "integrations.manage",
    ],
  },
  {
    label: "Users",
    permissions: [
      "users.view",
      "users.manage",
    ],
  },
  {
    label: "Settings",
    permissions: [
      "settings.view",
      "settings.manage",
    ],
  },
  {
    label: "Billing",
    permissions: [
      "billing.view",
      "billing.manage",
    ],
  },
];

function parsePermissions(
  value: string | null,
) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);

    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string =>
          typeof item === "string",
      );
    }
  } catch {}

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function permissionLabel(permission: string) {
  return permission
    .split(".")
    .map((part) =>
      part.charAt(0).toUpperCase() +
      part.slice(1),
    )
    .join(" ");
}

export default function TeamPage() {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [invitations, setInvitations] =
    useState<Invitation[]>([]);


  const [teams, setTeams] =
    useState<BusinessTeam[]>([]);

  const [showCreateTeam, setShowCreateTeam] =
    useState(false);

  const [teamName, setTeamName] =
    useState("");

  const [teamDepartment, setTeamDepartment] =
    useState("sales");

  const [teamDescription, setTeamDescription] =
    useState("");

  const [creatingTeam, setCreatingTeam] =
    useState(false);


  const [selectedTeamId, setSelectedTeamId] =
    useState<string | null>(null);

  const [teamMembers, setTeamMembers] =
    useState<Record<string, string[]>>({});

  const [assigningMember, setAssigningMember] =
    useState(false);


  const [aiEmployees, setAiEmployees] =
    useState<AIEmployee[]>([]);

  const [teamAiEmployees, setTeamAiEmployees] =
    useState<Record<string, string[]>>({});

  const [assigningAI, setAssigningAI] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] =
    useState<StaffMember | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [customPermissions, setCustomPermissions] =
    useState<string[]>([]);

  const [submitting, setSubmitting] =
    useState(false);

  async function loadTeam() {
    try {
      setLoading(true);
      setError("");

      const [
        membersResponse,
        invitationsResponse,
        teamsResponse,
        teamMembersResponse,
        teamAIResponse,
      ] = await Promise.all([
        fetch("/api/team/members"),
        fetch("/api/team/invitations"),
        fetch("/api/teams"),
        fetch("/api/teams/members"),
        fetch("/api/teams/ai-employees"),
      ]);

      const membersData =
        await membersResponse.json();

      const invitationsData =
        await invitationsResponse.json();

      if (!membersResponse.ok) {
        throw new Error(
          membersData.error ||
          "Unable to load team.",
        );
      }

      setMembers(
        membersData.members || [],
      );


      const teamsData =
        await teamsResponse.json();

      if (teamsResponse.ok) {
        setTeams(
          teamsData.teams || [],
        );
      }

      const teamMembersData =
        await teamMembersResponse.json();

      if (teamMembersResponse.ok) {
        const groupedMembers: Record<string, string[]> = {};

        for (const item of teamMembersData.memberships || []) {
          if (!groupedMembers[item.teamId]) {
            groupedMembers[item.teamId] = [];
          }

          groupedMembers[item.teamId].push(
            item.businessUserId,
          );
        }

        setTeamMembers(groupedMembers);
      }

      const teamAIData =
        await teamAIResponse.json();

      if (teamAIResponse.ok) {
        const groupedAI: Record<string, string[]> = {};

        for (const item of teamAIData.assignments || []) {
          if (!groupedAI[item.teamId]) {
            groupedAI[item.teamId] = [];
          }

          groupedAI[item.teamId].push(
            item.aiEmployeeId,
          );
        }

        setTeamAiEmployees(groupedAI);
      }


      const employeesResponse =
        await fetch("/api/ai-employees");

      const employeesData =
        await employeesResponse.json();

      if (employeesResponse.ok) {
        setAiEmployees(
          employeesData.employees || [],
        );
      }

      if (invitationsResponse.ok) {
        setInvitations(
          invitationsData.invitations || [],
        );
      } else {
        setInvitations([]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load team.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
  }, []);

  async function toggleTeamAI(
    teamId: string,
    aiEmployeeId: string,
  ) {
    try {
      setAssigningAI(true);
      setError("");

      const current =
        teamAiEmployees[teamId] || [];

      const assigned =
        current.includes(aiEmployeeId);

      const response = await fetch(
        "/api/teams/ai-employees",
        {
          method: assigned
            ? "DELETE"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            teamId,
            aiEmployeeId,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update AI employee assignment.",
        );
      }

      setTeamAiEmployees((previous) => ({
        ...previous,
        [teamId]: assigned
          ? current.filter(
              (id) =>
                id !== aiEmployeeId,
            )
          : [...current, aiEmployeeId],
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update AI employee assignment.",
      );
    } finally {
      setAssigningAI(false);
    }
  }

  async function toggleTeamMember(
    teamId: string,
    businessUserId: string,
  ) {
    try {
      setAssigningMember(true);
      setError("");

      const current =
        teamMembers[teamId] || [];

      const isMember =
        current.includes(businessUserId);

      const response = await fetch(
        "/api/teams/members",
        {
          method: isMember
            ? "DELETE"
            : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            teamId,
            businessUserId,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update team membership.",
        );
      }

      setTeamMembers((previous) => ({
        ...previous,
        [teamId]: isMember
          ? current.filter(
              (id) =>
                id !== businessUserId,
            )
          : [...current, businessUserId],
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update team membership.",
      );
    } finally {
      setAssigningMember(false);
    }
  }

  async function createTeam() {
    if (!teamName.trim()) {
      setError("Team name is required.");
      return;
    }

    try {
      setCreatingTeam(true);
      setError("");

      const response = await fetch(
        "/api/teams",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: teamName.trim(),
            department: teamDepartment,
            description:
              teamDescription.trim() || null,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to create team.",
        );
      }

      setTeamName("");
      setTeamDepartment("sales");
      setTeamDescription("");
      setShowCreateTeam(false);

      await loadTeam();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create team.",
      );
    } finally {
      setCreatingTeam(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setName("");
    setEmail("");
    setRole("member");
    setCustomPermissions([]);
    setError("");
    setShowAdd(true);
  }

  function openEdit(member: StaffMember) {
    setEditing(member);
    setName(member.name || "");
    setEmail(member.email || "");
    setRole(member.role);
    setCustomPermissions(
      parsePermissions(
        member.permissions,
      ),
    );
    setError("");
    setShowAdd(true);
  }

  function closeModal() {
    if (submitting) return;

    setShowAdd(false);
    setEditing(null);
  }

  function togglePermission(
    permission: string,
  ) {
    setCustomPermissions((current) =>
      current.includes(permission)
        ? current.filter(
            (item) => item !== permission,
          )
        : [...current, permission],
    );
  }

  async function inviteStaff(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!name.trim() || !email.trim()) {
      setError(
        "Name and email are required.",
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        "/api/team/invitations",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            role,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to create invitation.",
        );
      }

      closeModal();
      await loadTeam();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function saveMember(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    if (!editing) return;

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch(
        "/api/team/members",
        {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memberId: editing.id,
            role,
            permissions:
              customPermissions,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to update staff member.",
        );
      }

      closeModal();
      await loadTeam();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update staff member.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function removeMember(
    member: StaffMember,
  ) {
    const confirmed =
      window.confirm(
        `Remove ${member.name || member.email || "this staff member"} from the business?`,
      );

    if (!confirmed) return;

    try {
      setError("");

      const response = await fetch(
        "/api/team/members",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            memberId: member.id,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to remove staff member.",
        );
      }

      await loadTeam();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove staff member.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f8fafc] p-6">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Team & Staff
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Manage staff accounts, roles and access.
            </p>
          </div>

          <button
            onClick={openAdd}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            + Add Staff
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
            <div>
              <h2 className="font-semibold text-slate-900">
                Teams
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Organize employees around AI departments and shared conversation queues.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setShowCreateTeam(true);
              }}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              + Create Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="font-medium text-slate-900">
                No teams created yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Create a team such as Sales, Reception, or Customer Support.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 p-6 md:grid-cols-2 lg:grid-cols-3">
              {teams.map((team) => (
                <div
                  key={team.id}
                  className="rounded-xl border border-slate-200 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {team.name}
                      </h3>

                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-cyan-600">
                        {team.department.replace(/_/g, " ")}
                      </p>
                    </div>

                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                      Active
                    </span>
                  </div>

                  {team.description && (
                    <p className="mt-3 text-sm leading-5 text-slate-500">
                      {team.description}
                    </p>
                  )}

                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">
                      Team workspace
                    </p>

                    <p className="mt-1 text-sm font-medium text-slate-700">
                      Shared conversation access
                    </p>

                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTeamId(
                          team.id,
                        )
                      }
                      className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Manage Members
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Team Members
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  {members.length} staff member
                  {members.length === 1
                    ? ""
                    : "s"}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-slate-500">
              Loading team...
            </div>
          ) : members.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-medium text-slate-900">
                No staff members yet
              </p>

              <p className="mt-1 text-sm text-slate-500">
                Add your first staff member to get started.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-100 to-violet-100 text-sm font-bold text-slate-700">
                      {(member.name ||
                        member.email ||
                        "U")
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {member.name ||
                          "Team Member"}
                      </p>

                      <p className="truncate text-sm text-slate-500">
                        {member.email || ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                      {member.role}
                    </span>

                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Active
                    </span>

                    <button
                      onClick={() =>
                        openEdit(member)
                      }
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() =>
                        removeMember(member)
                      }
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {invitations.length > 0 && (
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">

            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="font-semibold text-slate-900">
                Pending Invitations
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Staff invitations waiting to be accepted.
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {invitations.map(
                (invitation) => (
                  <div
                    key={invitation.id}
                    className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {invitation.name ||
                          invitation.email}
                      </p>

                      <p className="text-sm text-slate-500">
                        {invitation.email}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold capitalize text-amber-700">
                        {invitation.role}
                      </span>

                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {selectedTeamId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    Manage Team
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Control which staff and AI employees belong to this team.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedTeamId(null)}
                  className="text-xl text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <div className="max-h-[520px] overflow-y-auto p-6">

                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  Team Members
                </h3>

                <div className="space-y-2">
                  {members.map((member) => {
                    const assigned =
                      (
                        teamMembers[selectedTeamId] || []
                      ).includes(member.id);

                    return (
                      <button
                        key={member.id}
                        type="button"
                        disabled={assigningMember}
                        onClick={() =>
                          toggleTeamMember(
                            selectedTeamId,
                            member.id,
                          )
                        }
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          assigned
                            ? "border-cyan-300 bg-cyan-50"
                            : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {member.name || "Unnamed member"}
                          </p>

                          <p className="text-xs text-slate-500">
                            {member.email}
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            assigned
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {assigned ? "Assigned" : "Assign"}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="my-6 border-t border-slate-200" />

                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
                  AI Employees
                </h3>

                <div className="space-y-2">
                  {aiEmployees.length === 0 ? (
                    <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                      No AI employees available.
                    </p>
                  ) : (
                    aiEmployees.map((employee) => {
                      const assigned =
                        (
                          teamAiEmployees[selectedTeamId] || []
                        ).includes(employee.id);

                      return (
                        <button
                          key={employee.id}
                          type="button"
                          disabled={assigningAI}
                          onClick={() =>
                            toggleTeamAI(
                              selectedTeamId,
                              employee.id,
                            )
                          }
                          className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                            assigned
                              ? "border-violet-300 bg-violet-50"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {employee.name}
                            </p>

                            <p className="text-xs capitalize text-slate-500">
                              {employee.type.replace(/_/g, " ")}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                              assigned
                                ? "bg-violet-100 text-violet-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {assigned ? "Assigned" : "Assign"}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

              </div>

              <div className="border-t border-slate-200 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedTeamId(null)}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        )}

        {showCreateTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-xl font-semibold text-slate-900">
                  Create Team
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Create a shared workspace for employees.
                </p>
              </div>

              <div className="space-y-5 px-6 py-6">

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Team name
                  </label>

                  <input
                    value={teamName}
                    onChange={(e) =>
                      setTeamName(e.target.value)
                    }
                    placeholder="Strategic Accounts"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Department
                  </label>

                  <select
                    value={teamDepartment}
                    onChange={(e) =>
                      setTeamDepartment(e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none focus:border-cyan-500"
                  >
                    <option value="sales">Sales</option>
                    <option value="reception">Reception</option>
                    <option value="customer_support">
                      Customer Support
                    </option>
                    <option value="finance">Finance</option>
                    <option value="operations">Operations</option>
                    <option value="marketing">Marketing</option>
                    <option value="management">Management</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Description
                  </label>

                  <textarea
                    value={teamDescription}
                    onChange={(e) =>
                      setTeamDescription(e.target.value)
                    }
                    placeholder="Handles strategic sales accounts and opportunities."
                    rows={3}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none focus:border-cyan-500"
                  />
                </div>

              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">

                <button
                  type="button"
                  disabled={creatingTeam}
                  onClick={() =>
                    setShowCreateTeam(false)
                  }
                  className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={creatingTeam}
                  onClick={createTeam}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {creatingTeam
                    ? "Creating..."
                    : "Create Team"}
                </button>

              </div>
            </div>
          </div>
        )}

        {showAdd && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
            <div className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

              <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">
                    {editing
                      ? "Edit Staff Member"
                      : "Add Staff Member"}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {editing
                      ? "Update this employee's role and access."
                      : "Create an invitation and assign a role."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeModal}
                  className="text-2xl leading-none text-slate-400 hover:text-slate-700"
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={
                  editing
                    ? saveMember
                    : inviteStaff
                }
                className="space-y-6 p-6"
              >
                <div className="grid gap-5 sm:grid-cols-2">

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Full name
                    </label>

                    <input
                      value={name}
                      onChange={(e) =>
                        setName(
                          e.target.value,
                        )
                      }
                      disabled={!!editing}
                      placeholder="John Mensah"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-700">
                      Email address
                    </label>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(
                          e.target.value,
                        )
                      }
                      disabled={!!editing}
                      placeholder="john@example.com"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-100 disabled:text-slate-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    Role
                  </label>

                  <select
                    value={role}
                    onChange={(e) =>
                      setRole(
                        e.target.value,
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    {roles.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {ROLE_LABELS[item as keyof typeof ROLE_LABELS]}
                      </option>
                    ))}
                  </select>
                </div>

                {editing && (
                  <div>
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-slate-900">
                        Custom permissions
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        These permissions are added on top of the selected role. The server will still enforce which permissions you are allowed to grant.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {permissionGroups.map(
                        (group) => (
                          <div
                            key={group.label}
                            className="rounded-xl border border-slate-200 p-4"
                          >
                            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                              {group.label}
                            </p>

                            <div className="space-y-2">
                              {group.permissions.map(
                                (permission) => (
                                  <label
                                    key={permission}
                                    className="flex cursor-pointer items-center gap-2"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={customPermissions.includes(
                                        permission,
                                      )}
                                      onChange={() =>
                                        togglePermission(
                                          permission,
                                        )
                                      }
                                      className="h-4 w-4 rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                                    />

                                    <span className="text-xs text-slate-700">
                                      {permissionLabel(
                                        permission,
                                      )}
                                    </span>
                                  </label>
                                ),
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {!editing && (
                  <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
                    <p className="text-sm font-semibold text-cyan-900">
                      Invitation
                    </p>

                    <p className="mt-1 text-xs leading-5 text-cyan-800">
                      Kuba will create a pending invitation for this staff member. They can use the invitation link to create or access their account and join this business with the selected role.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Saving..."
                      : editing
                        ? "Save Changes"
                        : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
