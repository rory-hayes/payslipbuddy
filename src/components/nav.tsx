"use client";

import clsx from "clsx";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/catalyst/badge";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/payslips", label: "Payslips" },
  { href: "/reports", label: "Reports" },
  { href: "/household", label: "Household" },
  { href: "/billing", label: "Billing" }
];

function isActivePath(currentPath: string, href: string) {
  if (href === "/dashboard" && (currentPath === "/" || currentPath === "/dashboard")) {
    return true;
  }
  return currentPath.startsWith(href);
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="font-[var(--font-heading)] text-xl font-bold tracking-tight text-zinc-950">
            PaySlip Buddy
          </Link>
          <Badge tone="blue">Payslip OS V1</Badge>
        </div>

        <nav className="flex flex-wrap items-center gap-2 md:gap-3">
          {navItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-semibold transition",
                  active
                    ? "border-zinc-900 bg-zinc-900 text-white shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
