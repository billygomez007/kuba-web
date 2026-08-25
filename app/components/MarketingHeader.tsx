"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  {
    name: "Products",
    href: "/products",
    items: [
      ["AI Workforce", "/products#ai-workforce"],
      ["Customer Operations", "/products#customer-operations"],
      ["Business Operations", "/products#business-operations"],
      ["Automation", "/products#automation"],
      ["Analytics", "/products#analytics"],
      ["Integrations", "/products#integrations"],
    ],
  },
  {
    name: "Solutions",
    href: "/solutions",
    items: [
      ["Increase Sales", "/solutions#increase-sales"],
      ["Automate Customer Support", "/solutions#customer-support"],
      ["Improve Operations", "/solutions#improve-operations"],
      ["Reduce Manual Work", "/solutions#reduce-manual-work"],
      ["AI Business Assistant", "/solutions#ai-business-assistant"],
    ],
  },
  {
    name: "Industries",
    href: "/industries",
    items: [
      ["Travel", "/industries#travel"],
      ["Healthcare", "/industries#healthcare"],
      ["Real Estate", "/industries#real-estate"],
      ["Education", "/industries#education"],
      ["Retail", "/industries#retail"],
      ["Professional Services", "/industries#professional-services"],
      ["Small Businesses", "/industries#small-businesses"],
    ],
  },
  {
    name: "Resources",
    href: "/resources",
    items: [
      ["Blog", "/resources#blog"],
      ["Guides", "/resources#guides"],
      ["Help Center", "/resources#help-center"],
      ["Documentation", "/resources#documentation"],
      ["AI Resources", "/resources#ai-resources"],
    ],
  },
] as const;

export default function MarketingHeader() {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  function closeMenus() {
    setOpenDropdown(null);
    setMobileOpen(false);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#060609]/90 backdrop-blur-2xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center" onClick={closeMenus}>
          <Image
            src="/brand/superkuba-logo.png"
            alt="SuperKuba"
            width={2172}
            height={724}
            priority
            className="h-auto w-[150px] object-contain sm:w-[175px]"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label="Main navigation">
          {navigation.map((item) => (
            <div key={item.name} className="relative">
              <button
                type="button"
                aria-expanded={openDropdown === item.name}
                onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)}
                className="flex items-center gap-1.5 text-sm font-medium text-white/65 transition hover:text-white"
              >
                {item.name}
                <ChevronDown className={`h-3.5 w-3.5 transition ${openDropdown === item.name ? "rotate-180" : ""}`} />
              </button>

              {openDropdown === item.name && (
                <div className="absolute left-1/2 top-10 w-72 -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0b0b12] p-3 shadow-2xl shadow-black/50">
                  <Link href={item.href} onClick={closeMenus} className="block rounded-xl px-4 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cyan-300 hover:bg-white/[0.06]">
                    Explore {item.name}
                  </Link>
                  {item.items.map(([label, href]) => (
                    <Link key={label} href={href} onClick={closeMenus} className="block rounded-xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white">
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <Link href="/#pricing" onClick={closeMenus} className="text-sm font-medium text-white/65 transition hover:text-white">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden text-sm font-semibold text-white/70 transition hover:text-white sm:block">
            Log in
          </Link>
          <Link href="/signup" className="hidden rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-white/90 sm:block">
            Start for Free
          </Link>
          <button type="button" aria-label={mobileOpen ? "Close navigation" : "Open navigation"} aria-expanded={mobileOpen} onClick={() => setMobileOpen(!mobileOpen)} className="rounded-xl border border-white/10 p-2.5 text-white md:hidden">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav className="max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-white/[0.06] bg-[#08080d] px-6 py-5 md:hidden" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <div key={item.name} className="border-b border-white/[0.06] py-2">
              <button type="button" aria-expanded={openDropdown === item.name} onClick={() => setOpenDropdown(openDropdown === item.name ? null : item.name)} className="flex w-full items-center justify-between py-3 text-left font-semibold text-white">
                {item.name}
                <ChevronDown className={`h-4 w-4 transition ${openDropdown === item.name ? "rotate-180" : ""}`} />
              </button>
              {openDropdown === item.name && (
                <div className="pb-3 pl-3">
                  <Link href={item.href} onClick={closeMenus} className="block py-2 text-sm font-semibold text-cyan-300">Explore {item.name}</Link>
                  {item.items.map(([label, href]) => (
                    <Link key={label} href={href} onClick={closeMenus} className="block py-2 text-sm text-white/60">{label}</Link>
                  ))}
                </div>
              )}
            </div>
          ))}
          <Link href="/#pricing" onClick={closeMenus} className="block border-b border-white/[0.06] py-5 font-semibold text-white">Pricing</Link>
          <div className="grid grid-cols-2 gap-3 pt-5">
            <Link href="/login" onClick={closeMenus} className="rounded-full border border-white/15 px-4 py-3 text-center text-sm font-bold text-white">Log in</Link>
            <Link href="/signup" onClick={closeMenus} className="rounded-full bg-white px-4 py-3 text-center text-sm font-bold text-black">Start for Free</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
