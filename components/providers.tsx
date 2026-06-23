"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { RaceSocketProvider } from "@/hooks/use-race-socket";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RaceSocketProvider>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </RaceSocketProvider>
    </ThemeProvider>
  );
}
