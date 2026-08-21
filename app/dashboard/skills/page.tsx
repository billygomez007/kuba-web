import SkillsMarketplace from "@/app/components/skills/SkillsMarketplace";


export default function SkillsPage() {

  return (
    <main className="min-h-screen bg-[#07070A] px-6 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        <h1 className="text-3xl font-bold">
          Kuba Skill Marketplace
        </h1>

        <p className="mt-2 text-white/50">
          Give your AI employees new capabilities.
        </p>


        <SkillsMarketplace />

      </div>

    </main>
  );
}
