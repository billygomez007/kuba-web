import Image from "next/image";
import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050507]">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="grid gap-12 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center">
              <Image
                src="/brand/superkuba-logo.png"
                alt="SuperKuba"
                width={2172}
                height={724}
                className="h-auto w-[170px] object-contain"
              />
            </Link>

            <p className="mt-5 max-w-md leading-7 text-white/35">
              Your business, powered by an AI workforce. AI employees,
              automation, workflows, knowledge and intelligent operations
              in one platform.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="font-bold">Platform</h3>

            <div className="mt-5 space-y-3 text-sm text-white/40">
              <Link className="block hover:text-white" href="/#workforce">
                AI Workforce
              </Link>

              <Link className="block hover:text-white" href="/#platform">
                Platform
              </Link>

              <Link className="block hover:text-white" href="/#solutions">
                Solutions
              </Link>

              <Link className="block hover:text-white" href="/pricing">
                Pricing
              </Link>
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-bold">SuperKuba</h3>

            <div className="mt-5 space-y-3 text-sm text-white/40">
              <Link className="block hover:text-white" href="/login">
                Log in
              </Link>

              <Link className="block hover:text-white" href="/signup">
                Get started
              </Link>

              <Link className="block hover:text-white" href="/demo">
                Contact
              </Link>

              <Link className="block hover:text-white" href="/resources#documentation">
                Documentation
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.06] pt-7 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
          <span>
            © {new Date().getFullYear()} SuperKuba. All rights reserved.
          </span>

          <div className="flex gap-5">
            <Link className="hover:text-white" href="/privacy">
              Privacy
            </Link>
            <Link className="hover:text-white" href="/terms">
              Terms
            </Link>
            <Link className="hover:text-white" href="/security">
              Security
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
