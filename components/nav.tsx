"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectionStatus } from "@/components/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/gates", label: "Gates" },
  { href: "/mappings", label: "Mappings" },
  { href: "/manual", label: "Manual" },
  { href: "/settings", label: "Settings" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6">
        <Link href="/" className="text-lg font-semibold text-status-ok">
          GateStage
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto text-base">
          {links.map((link) => {
            const active = isActivePath(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <ConnectionStatus />
        <ThemeToggle />
      </div>
    </header>
  );
}
