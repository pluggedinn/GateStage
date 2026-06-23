import type { Metadata } from "next";
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
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
