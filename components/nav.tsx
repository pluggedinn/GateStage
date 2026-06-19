import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/gates", label: "Gates" },
  { href: "/mappings", label: "Mappings" },
  { href: "/manual", label: "Manual" },
];

export function Nav() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-emerald-400">
          GateStage
        </Link>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
