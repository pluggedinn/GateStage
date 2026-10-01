"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ConnectionStatus } from "@/components/connection-status";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/gates", label: "Gates" },
  { href: "/routines", label: "Routines" },
  { href: "/manual", label: "Manual" },
  { href: "/settings", label: "Settings" },
  { href: "/logs", label: "Logs" },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card pt-[env(safe-area-inset-top)]">
      <div className="shell-x mx-auto flex max-w-6xl items-center gap-2 py-2 lg:gap-6 lg:py-3">
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-1 text-lg font-semibold"
          onClick={() => setOpen(false)}
        >
          <img
            src="/gatestage-logo.png"
            alt=""
            width={164}
            height={128}
            className="h-8 w-auto shrink-0"
          />
          <span className="brand-wordmark min-w-0 truncate">GateStage</span>
        </Link>
        <nav
          aria-label="Primary"
          data-testid="desktop-nav"
          className="hidden min-w-0 flex-1 gap-1 text-base lg:flex"
        >
          {links.map((link) => (
            <NavLink key={link.href} href={link.href} pathname={pathname} />
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1 lg:gap-2">
          <ConnectionStatus />
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11 lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            data-testid="mobile-menu-button"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>
      <nav
        id="mobile-nav"
        aria-label="Mobile"
        data-testid="mobile-nav"
        className={cn(
          "flex max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col gap-3 overflow-y-auto border-t border-border p-4 lg:hidden",
          !open && "hidden",
        )}
      >
        {links.map((link) => (
          <NavLink
            key={link.href}
            href={link.href}
            pathname={pathname}
            mobile
            onNavigate={() => setOpen(false)}
          />
        ))}
        <div className="mt-1 border-t border-border pt-3">
          <ThemeToggle layout="menu" />
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  href,
  pathname,
  mobile,
  onNavigate,
}: {
  href: string;
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const link = links.find((item) => item.href === href);
  if (!link) return null;
  const active = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        mobile
          ? "flex min-h-12 items-center rounded-lg px-4 text-base"
          : "rounded-md px-2.5 py-1 transition-colors",
        active
          ? "bg-muted font-medium text-foreground"
          : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {link.label}
    </Link>
  );
}
