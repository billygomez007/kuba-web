import InstalledSkills from "@/app/components/skills/InstalledSkills";


export default function InstalledSkillsPage() {

  return (
    <main className="min-h-screen bg-[#07070A] px-6 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        <h1 className="text-3xl font-bold">
          Installed AI Skills
        </h1>

        <p className="mt-2 text-white/50">
          Manage capabilities across your AI workforce.
        </p>


        <InstalledSkills />

      </div>

    </main>
  );
}
