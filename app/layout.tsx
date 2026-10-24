import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Instrument_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const display = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap" });
const ui = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

const description = "Aftershock turns each production incident into a regression test that git history proves, then guards every pull request against it.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://127.0.0.1:3000"),
  title: { default: "Aftershock — incidents become proven tests", template: "%s · Aftershock" },
  description,
  applicationName: "Aftershock",
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: "Aftershock", title: "Aftershock — incidents become proven tests", description },
  twitter: { card: "summary_large_image", title: "Aftershock — incidents become proven tests", description },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0E14" },
    { media: "(prefers-color-scheme: light)", color: "#F5F7FA" },
  ],
};

/** Applies a saved theme before first paint; without one, CSS follows the system setting. */
const THEME_SCRIPT = `try{var t=localStorage.getItem("as-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable} ${display.variable} ${ui.variable} ${code.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
