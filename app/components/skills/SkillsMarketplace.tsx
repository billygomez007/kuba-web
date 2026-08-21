"use client";

import { useEffect, useState } from "react";


type Skill = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  publisher: string;
  rating: number;
  installCount: number;
};


type Employee = {
  id: string;
  name: string;
  type: string;
};


export default function SkillsMarketplace() {

  const [skills, setSkills] = useState<Skill[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);

  const [role, setRole] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);


  async function loadSkills() {

    const response =
      await fetch("/api/skills");

    const data =
      await response.json();

    setSkills(
      data.skills || [],
    );

    setLoading(false);
  }


  async function loadEmployees() {

    const response =
      await fetch("/api/skills/employees");

    const data =
      await response.json();

    setEmployees(
      data.employees || [],
    );
  }


  async function installSkill(
    employeeId: string,
  ) {

    if (!selectedSkill) return;

    setInstalling(true);


    await fetch(
      "/api/skills/install",
      {
        method: "POST",
        headers:{
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          skillId:
            selectedSkill.id,

          employeeId,
        }),
      },
    );


    setInstalling(false);
    setSelectedSkill(null);

    setMessage(
      "Skill installed successfully.",
    );
  }


  async function loadRole() {
    const response =
      await fetch("/api/auth/me");

    if (!response.ok) return;

    const data =
      await response.json();

    setRole(
      data.membership?.role || null,
    );
  }


  useEffect(() => {
    loadSkills();
    loadRole();
  }, []);


  if (loading) {
    return (
      <div className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6">
        Loading skills...
      </div>
    );
  }


  return (
    <section className="mt-8">


      <div className="grid gap-6 md:grid-cols-3">

        {skills.map((skill) => (

          <div
            key={skill.id}
            className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6"
          >

            <h2 className="text-xl font-bold">
              {skill.name}
            </h2>


            <p className="mt-2 text-blue-400">
              {skill.category}
            </p>


            <p className="mt-4 text-sm text-white/60">
              {skill.description}
            </p>


            <p className="mt-4 text-sm text-white/50">
              ⭐ {skill.rating}
            </p>


            {role === "owner" && (
              <button
                onClick={() => {
                  setSelectedSkill(skill);
                  loadEmployees();
                }}
                className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold"
              >
                Install Skill
              </button>
            )}


          </div>

        ))}

      </div>


      {selectedSkill && (

        <div className="fixed inset-0 flex items-center justify-center bg-black/70">

          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111116] p-6">

            <h2 className="text-xl font-bold">
              Install {selectedSkill.name}
            </h2>


            <p className="mt-4 text-sm text-white/50">
              Choose AI employee
            </p>


            <div className="mt-4 space-y-3">

              {employees.map((employee) => (

                <button
                  key={employee.id}
                  disabled={installing}
                  onClick={() =>
                    installSkill(employee.id)
                  }
                  className="w-full rounded-xl bg-white/10 px-4 py-3 text-left hover:bg-white/20"
                >
                  {employee.name}
                </button>

              ))}

            </div>


            <button
              onClick={() =>
                setSelectedSkill(null)
              }
              className="mt-5 text-sm text-white/50"
            >
              Cancel
            </button>


          </div>

        </div>

      )}


    </section>
  );
}
