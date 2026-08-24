import Link from "next/link";
import { notFound } from "next/navigation";

import { getMarketplaceProduct, marketplaceProducts } from "../catalog";

export default function MarketplaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <MarketplaceDetailContent params={params} />;
}

async function MarketplaceDetailContent({ params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const product = getMarketplaceProduct(resolved.id);

  if (!product) {
    notFound();
  }

  const recommendations = marketplaceProducts
    .filter((item) => item.industry === product.industry && item.id !== product.id)
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1200px]">
        <Link href="/dashboard/marketplace" className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40 hover:text-cyan-300">
          ← Marketplace
        </Link>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">{product.category}</p>
                <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">{product.name}</h1>
              </div>
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-bold text-violet-200">{product.price}</span>
            </div>

            <p className="mt-4 text-base leading-7 text-white/45">{product.description}</p>

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <SmallStat label="Industry" value={product.industry} />
              <SmallStat label="Provider" value={product.provider} />
              <SmallStat label="Rating" value={`${product.rating}/5`} />
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">Features</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/60">
                  {product.features.map((feature) => <li key={feature}>{feature}</li>)}
                </ul>
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">Capabilities</h2>
                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-white/60">
                  {product.capabilities.map((capability) => <li key={capability}>{capability}</li>)}
                </ul>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.04] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/70">Pricing</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-3xl font-black">{product.price}</p>
              <p className="mt-2 text-sm text-white/45">Includes support and configuration guidance.</p>
            </div>

            <div className="mt-6 space-y-3 text-sm text-white/60">
              <p><span className="font-bold text-white/80">Required integrations:</span> {product.requiredIntegrations.join(", ")}</p>
              <p><span className="font-bold text-white/80">Required permissions:</span> {product.requiredPermissions.join(", ")}</p>
              <p><span className="font-bold text-white/80">Provider:</span> {product.developerName}</p>
              <p><span className="font-bold text-white/80">Version:</span> {product.version}</p>
              <p><span className="font-bold text-white/80">Last updated:</span> {product.lastUpdated}</p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href={product.demoHref} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-bold text-white/80 hover:bg-white/[0.08]">
                Demo / simulation
              </Link>
              <Link href="/dashboard/marketplace/subscriptions" className="rounded-xl bg-cyan-400 px-4 py-3 text-center text-sm font-bold text-black hover:bg-cyan-300">
                Review and install
              </Link>
            </div>
          </aside>
        </div>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-200/70">Recommended</p>
          <h2 className="mt-2 text-2xl font-black">{product.recommendation}</h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {recommendations.map((item) => (
              <Link key={item.id} href={`/dashboard/marketplace/${item.id}`} className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:border-cyan-300/20">
                <p className="text-xs uppercase tracking-[0.2em] text-cyan-200/60">{item.category}</p>
                <h3 className="mt-2 text-xl font-black">{item.name}</h3>
                <p className="mt-2 text-sm text-white/45">{item.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-white/25">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  );
}
