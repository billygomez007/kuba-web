"use client";

import { useEffect, useState } from "react";


type InstalledSkill = {
  skillId: string;
  skillName: string;
  category: string;
  employeeId: string;
  employeeName: string;
};


export default function InstalledSkills() {

  const [skills, setSkills] =
    useState<InstalledSkill[]>([]);

  const [loading, setLoading] =
    useState(true);


  async function loadSkills() {

    const response =
      await fetch(
        "/api/skills/installed",
      );

    const data =
      await response.json();

    setSkills(
      data.installedSkills || [],
    );

    setLoading(false);
  }


  useEffect(() => {
    loadSkills();
  }, []);


  if (loading) {
    return (
      <div className="mt-8 rounded-3xl border border-white/10 p-6">
        Loading installed skills...
      </div>
    );
  }


  return (
    <section className="mt-8 grid gap-5 md:grid-cols-2">

      {skills.map((item) => (

        <div
          key={`${item.skillId}-${item.employeeId}`}
          className="rounded-3xl border border-white/[0.08] bg-white/[0.035] p-6"
        >

          <h2 className="text-xl font-bold">
            {item.skillName}
          </h2>


          <p className="mt-2 text-blue-400">
            {item.category}
          </p>


          <div className="mt-5">

            <p className="text-xs uppercase text-white/40">
              Assigned To
            </p>


            <p className="mt-2 font-semibold">
              {item.employeeName}
            </p>

          </div>


        </div>

      ))}

    </section>
  );
}
