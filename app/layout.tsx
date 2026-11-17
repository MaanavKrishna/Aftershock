import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { THEME_SCRIPT } from "@/lib/theme";

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
    { media: "(prefers-color-scheme: dark)", color: "#08090C" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAFB" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
