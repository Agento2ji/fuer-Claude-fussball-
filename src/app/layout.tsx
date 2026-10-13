import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { THEME_INIT_SCRIPT, ThemeToggle } from "@/components/theme-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Fußball-Hub", template: "%s · Fußball-Hub" },
  description:
    "Spielerstatus, Statistik, Formbewertung und Quotenvergleich an einem Ort.",
};

export const viewport: Viewport = {
  themeColor: "#14181f",
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <TooltipProvider>
          <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
            <div className="mx-auto flex h-12 max-w-2xl items-center justify-between px-4">
              <Link href="/" className="font-semibold tracking-tight">
                Fußball-Hub
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link href="/spieler" className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
                  Spieler
                </Link>
                <Link href="/quoten" className="rounded-md px-2 py-1 text-muted-foreground hover:text-foreground">
                  Quoten
                </Link>
                <ThemeToggle />
              </nav>
            </div>
          </header>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
