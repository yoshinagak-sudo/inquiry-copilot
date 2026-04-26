"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "受信箱", match: (p: string) => p === "/" || p.startsWith("/inquiries") },
  { href: "/knowledge", label: "ナレッジ", match: (p: string) => p === "/knowledge" },
  { href: "/knowledge/candidates", label: "候補レビュー", match: (p: string) => p.startsWith("/knowledge/candidates") },
] as const;

export const AppHeader = () => {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-6 px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-900 transition-colors hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 rounded-sm"
          aria-label="inquiry-copilot ホーム"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-emerald-700 text-[13px] font-semibold text-white"
          >
            稲
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            inquiry-copilot
          </span>
          <span className="hidden text-[11px] text-stone-500 md:inline">
            サンプル農園
          </span>
        </Link>

        <nav className="flex items-center gap-1 text-sm" aria-label="メインナビ">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "relative rounded-md px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                  active
                    ? "text-emerald-800 font-medium"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-emerald-600"
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
