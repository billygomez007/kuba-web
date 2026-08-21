"use client";

import { useEffect, useState } from "react";


type Skill = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string;
  installedAt?: string;
};


export default function EmployeeSkills({
  employeeId,
}: {
  employeeId: string;
}) {

  const [installedSkills, setInstalledSkills] =
    useState<Skill[]>([]);

  const [availableSkills, setAvailableSkills] =
    useState<Skill[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [assigning, setAssigning] =
    useState<string | null>(null);

  const [removing, setRemoving] =
    useState<string | null>(null);


  async function loadSkills() {

    try {

      const response =
        await fetch(
          `/api/ai-employees/${employeeId}/skills`,
        );

      const data =
        await response.json();


      setInstalledSkills(
        data.installedSkills || [],
      );


      setAvailableSkills(
        data.availableSkills || [],
      );


    } finally {

      setLoading(false);

    }
  }



  async function assignSkill(
    skillId: string,
  ) {

    setAssigning(skillId);


    await fetch(
      `/api/ai-employees/${employeeId}/skills/assign`,
      {
        method:"POST",
        headers:{
          "Content-Type":
            "application/json",
        },
        body:JSON.stringify({
          skillId,
        }),
      },
    );


    await loadSkills();


    setAssigning(null);
  }

  async function removeSkill(
    skillId: string,
  ) {

    setRemoving(skillId);

    await fetch(
      `/api/ai-employees/${employeeId}/skills/remove`,
      {
        method:"POST",
        headers:{
          "Content-Type":
            "application/json",
        },
        body:JSON.stringify({
          skillId,
        }),
      },
    );

    await loadSkills();

    setRemoving(null);
  }



  useEffect(() => {
    loadSkills();
  }, [employeeId]);



  if (loading) {

    return (
      <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6">
        Loading skills...
      </section>
    );

  }



  return (

    <section className="mt-8 rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6">


      <div className="mb-6">

        <h2 className="text-xl font-bold">
          AI Employee Skills
        </h2>

        <p className="mt-1 text-sm text-white/50">
          Install capabilities that improve this AI employee.
        </p>

      </div>



      <h3 className="mb-3 text-sm font-semibold uppercase text-white/40">
        Installed Skills
      </h3>


      <div className="grid gap-4 md:grid-cols-2">

        {installedSkills.length === 0 ? (

          <p className="text-sm text-white/40">
            No skills installed yet.
          </p>

        ) : (

          installedSkills.map((skill)=>(

            <div
              key={skill.id}
              className="rounded-2xl border border-green-500/20 bg-green-500/5 p-4"
            >

              <h4 className="font-semibold">
                ✓ {skill.name}
              </h4>


              <p className="mt-1 text-xs text-white/40">
                {skill.category}
              </p>


              <p className="mt-3 text-sm text-white/60">
                {skill.description}
              </p>

              <button
                onClick={() =>
                  removeSkill(skill.id)
                }
                disabled={
                  removing === skill.id
                }
                className="mt-4 rounded-xl border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                {removing === skill.id
                  ? "Removing..."
                  : "Remove"}
              </button>


            </div>

          ))

        )}

      </div>



      <h3 className="mb-3 mt-8 text-sm font-semibold uppercase text-white/40">
        Available Skills
      </h3>



      <div className="grid gap-4 md:grid-cols-2">

        {availableSkills.map((skill)=>(

          <div
            key={skill.id}
            className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"
          >

            <div className="flex items-start justify-between">


              <div>

                <h4 className="font-semibold">
                  {skill.name}
                </h4>


                <p className="mt-1 text-xs text-white/40">
                  {skill.category}
                </p>


                <p className="mt-3 text-sm text-white/60">
                  {skill.description}
                </p>

              </div>



              <button
                onClick={() =>
                  assignSkill(skill.id)
                }
                disabled={
                  assigning === skill.id
                }
                className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold hover:bg-blue-500 disabled:opacity-50"
              >

                {assigning === skill.id
                  ? "Adding..."
                  : "Assign"}

              </button>


            </div>


          </div>

        ))}

      </div>


    </section>

  );
}
