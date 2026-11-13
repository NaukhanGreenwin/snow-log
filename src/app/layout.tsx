import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

// Font is downloaded at build time and self-hosted: no third-party requests at runtime.
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

const isDev = process.env.NODE_ENV !== "production";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// connect-src: Open-Meteo for weather, https: for optional company logos (PDF header).
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https:",
  "font-src 'self'",
  `connect-src 'self' blob: data: https:${isDev ? " ws:" : ""}`,
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export const metadata: Metadata = {
  title: "Snow Log",
  description: "Snow clearing and salting log for property sites.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  icons: { icon: `${BASE}/brand/icon.png`, apple: `${BASE}/brand/icon.png` },
  manifest: `${BASE}/manifest.webmanifest`,
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Snow Log", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-CA" className={sans.variable}>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta name="color-scheme" content="light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
