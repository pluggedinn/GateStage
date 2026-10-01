"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ layout = "icon" }: { layout?: "icon" | "menu" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";
  const icon = mounted ? (
    isDark ? (
      <Sun className="size-5" />
    ) : (
      <Moon className="size-5" />
    )
  ) : (
    <span className="size-5" aria-hidden />
  );

  if (layout === "menu") {
    return (
      <Button
        type="button"
        variant="ghost"
        className="h-12 w-full justify-start gap-3 rounded-lg px-4 text-base font-normal text-muted-foreground"
        aria-label={label}
        disabled={!mounted}
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {icon}
        <span>{label}</span>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-11 shrink-0"
      aria-label={label}
      disabled={!mounted}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {icon}
    </Button>
  );
}
