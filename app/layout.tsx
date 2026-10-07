import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

const description = "Aftershock turns each production incident into a regression test that git history proves, then guards every pull request against it.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://127.0.0.1:3000"),
  title: { default: "Aftershock — incidents become proven tests", template: "%s · Aftershock" },
  description,
  applicationName: "Aftershock",
  openGraph: { type: "website", siteName: "Aftershock", title: "Aftershock — incidents become proven tests", description },
  twitter: { card: "summary", title: "Aftershock — incidents become proven tests", description },
};

export const viewport: Viewport = { themeColor: "#0E141B" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
