import Image from "next/image";

export type ShowcaseTone = "violet" | "cyan";

const TONE_BLOBS: Record<ShowcaseTone, string[]> = {
  violet: [
    "absolute left-1/2 top-1/3 h-[440px] w-[72%] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[150px]",
    "absolute left-[-10%] top-[-18%] h-80 w-80 rounded-full bg-cyan-400/10 blur-[120px]",
    "absolute bottom-[-24%] right-[-8%] h-80 w-80 rounded-full bg-fuchsia-500/10 blur-[120px]",
  ],
  cyan: [
    "absolute left-1/2 top-1/3 h-[440px] w-[72%] -translate-x-1/2 rounded-full bg-cyan-500/15 blur-[150px]",
    "absolute right-[-10%] top-[-18%] h-80 w-80 rounded-full bg-blue-500/10 blur-[120px]",
    "absolute bottom-[-24%] left-[-8%] h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]",
  ],
};

const TONE_EYEBROW: Record<ShowcaseTone, string> = {
  violet: "border-violet-300/15 bg-violet-300/[0.06] text-violet-200/80",
  cyan: "border-cyan-300/15 bg-cyan-300/[0.06] text-cyan-200/80",
};

const TONE_GLOW: Record<ShowcaseTone, string> = {
  violet: "bg-gradient-to-r from-violet-500/30 via-cyan-400/20 to-fuchsia-500/30",
  cyan: "bg-gradient-to-r from-cyan-400/25 via-blue-500/30 to-violet-500/30",
};

/**
 * Canonical product-showcase section. Replaces 6 near-identical
 * components (SuperKuba{Dashboard,AIWorkforce,Analytics,Automation,
 * BusinessOperations,CustomerOperations}Showcase) that differed only in
 * copy, image, and an arbitrary blob-color permutation carrying no
 * product meaning. Content differences are preserved via props; the
 * decorative treatment is now a deliberate 2-tone system instead of one
 * bespoke gradient combination per page.
 */
export default function ProductShowcase({
  id,
  eyebrow,
  title,
  description,
  imageSrc,
  imageAlt,
  tone = "violet",
  className = "",
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  tone?: ShowcaseTone;
  className?: string;
}) {
  const titleId = `${id}-showcase-title`;

  return (
    <section
      id={id}
      className={`scroll-mt-24 relative overflow-hidden border-y border-white/[0.06] px-6 py-24 sm:py-28 lg:px-8 lg:py-32 ${className}`}
      aria-labelledby={titleId}
    >
      <div className="pointer-events-none absolute inset-0">
        {TONE_BLOBS[tone].map((blobClass) => (
          <div key={blobClass} className={blobClass} />
        ))}
      </div>

      <div className="relative mx-auto max-w-[1500px]">
        <div className="mx-auto max-w-3xl text-center">
          <div className={`inline-flex items-center rounded-pill border px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] ${TONE_EYEBROW[tone]}`}>
            {eyebrow}
          </div>

          <h2 id={titleId} className="mt-7 text-balance text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
            {title}
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">{description}</p>
        </div>

        <div className="relative mx-auto mt-14 sm:mt-16 lg:mt-20">
          <div className={`absolute inset-x-[8%] bottom-[-4%] h-24 rounded-full blur-[70px] ${TONE_GLOW[tone]}`} />

          <div className="relative rounded-panel border border-white/10 bg-white/[0.035] p-1.5 shadow-dialog backdrop-blur-xl sm:p-2.5">
            <div className="overflow-hidden rounded-[17px] border border-white/[0.08] bg-surface-raised sm:rounded-[24px]">
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={2864}
                height={1628}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 94vw, 1500px"
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
