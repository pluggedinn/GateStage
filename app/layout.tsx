import type { Metadata, Viewport } from "next";
import { Arimo } from "next/font/google";
import { Nav } from "@/components/nav";
import { Providers } from "@/components/providers";
import "./globals.css";

const arimo = Arimo({
  variable: "--font-arimo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GateStage",
  description: "LED gate control for FPV whoop races",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${arimo.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-base">
        <Providers>
          <Nav />
          <main className="shell-x mx-auto w-full max-w-6xl flex-1 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] lg:pt-6 lg:pb-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
