import Image from "next/image";

type SuperKubaAnalyticsShowcaseProps = {
  className?: string;
};

export default function SuperKubaAnalyticsShowcase({
  className = "",
}: SuperKubaAnalyticsShowcaseProps) {
  return (
    <section
      className={`relative overflow-hidden border-y border-white/[0.06] bg-[#05070d] px-6 py-24 sm:py-28 lg:px-8 lg:py-32 ${className}`}
      aria-labelledby="superkuba-analytics-showcase-title"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[440px] w-[72%] -translate-x-1/2 rounded-full bg-blue-600/15 blur-[150px]" />
        <div className="absolute left-[-10%] top-[-18%] h-80 w-80 rounded-full bg-cyan-400/10 blur-[120px]" />
        <div className="absolute bottom-[-24%] right-[-8%] h-80 w-80 rounded-full bg-violet-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center rounded-full border border-blue-300/15 bg-blue-300/[0.06] px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-200/80">
            Analytics &amp; Intelligence
          </div>

          <h2
            id="superkuba-analytics-showcase-title"
            className="mt-7 text-balance text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl"
          >
            AI-Powered Business Intelligence
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-7 text-white/50 sm:text-lg sm:leading-8">
            Transform your business data into real-time insights, performance
            tracking, and smarter decisions with SuperKuba Analytics.
          </p>
        </div>

        <div className="relative mx-auto mt-14 sm:mt-16 lg:mt-20">
          <div className="absolute inset-x-[8%] bottom-[-4%] h-24 rounded-full bg-gradient-to-r from-cyan-400/25 via-blue-500/30 to-violet-500/30 blur-[70px]" />

          <div className="relative rounded-[22px] border border-white/10 bg-white/[0.035] p-1.5 shadow-[0_35px_120px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:rounded-[30px] sm:p-2.5">
            <div className="overflow-hidden rounded-[17px] border border-white/[0.08] bg-[#060914] sm:rounded-[24px]">
              <Image
                src="/images/superkuba-analytics-mockup.png"
                alt="SuperKuba AI-powered business analytics dashboard"
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
