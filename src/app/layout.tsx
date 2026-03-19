import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GameProvider } from "@/lib/game-context";
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
  title: "Lost Cities Scorer",
  description:
    "Score your Lost Cities card game instantly — snap a photo or enter cards manually.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lost Cities Scorer",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1c1917",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable}`}
    >
      <body className="antialiased flex min-h-dvh flex-col">
        <GameProvider>
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          <footer className="shrink-0 border-t border-border/50 px-4 py-3 text-center text-xs text-muted-foreground">
            <p>
              <span>© {year}. Created by </span>
              <a
                href="https://gattey.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground/90 underline-offset-2 transition-colors hover:text-foreground hover:underline"
              >
                Dylan Gattey
              </a>
            </p>
          </footer>
        </GameProvider>
      </body>
    </html>
  );
}
