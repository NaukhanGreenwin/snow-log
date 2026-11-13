/* One deployment, many companies: ?c=<slug> picks the brand from src/brands.json (added with
   scripts/add_brands.py). The chosen slug is remembered on the phone so the home-screen icon and
   offline reloads keep the same brand. No slug = the IT Rapid Support demo brand. */
import brands from "../brands.json";

export interface Brand {
  slug: string;
  name: string;
  /** self-hosted logo "logos/<slug>.png" (under the app's base path) or a legacy https URL;
      no logo = a monogram in the accent colour */
  logo?: string;
  /** logo pixel size, for layout before it loads */
  logoW?: number;
  logoH?: number;
  /** white/light logo on a transparent background: shown on an accent tile instead of white */
  logoLight?: boolean;
  /** hex, used for buttons and the report rule */
  accent?: string;
  city?: string;
  sampleProperty?: string;
  sampleAddress?: string;
}

export const MAKER = "IT Rapid Support";
export const DEFAULT_ACCENT = "#1f3a5f";

const DEMO: Brand = {
  slug: "demo",
  name: "Sample Property Management",
  accent: DEFAULT_ACCENT,
  city: "Calgary",
  sampleProperty: "Kestrel Court Apartments",
  sampleAddress: "1450 Kestrel Way SW, Calgary, AB",
};

const LIST = brands as Brand[];
const KEY = "snowlog-brand";

export function brandBySlug(slug: string | null | undefined): Brand | null {
  if (!slug) return null;
  const s = slug.trim().toLowerCase();
  if (s === "demo") return DEMO;
  return LIST.find((b) => b.slug === s) ?? null;
}

export function currentBrand(): Brand {
  if (typeof window === "undefined") return DEMO;
  const q = new URLSearchParams(window.location.search).get("c");
  const fromQ = brandBySlug(q);
  if (fromQ) { try { localStorage.setItem(KEY, fromQ.slug); } catch { /* ignore */ } return fromQ; }
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch { /* ignore */ }
  return brandBySlug(saved) ?? DEMO;
}

/** Hex accent, guarded: falls back to the default if missing or unreadable on white. */
export function accentOf(b: Brand): string {
  const a = (b.accent ?? "").trim();
  if (!/^#[0-9a-f]{6}$/i.test(a)) return DEFAULT_ACCENT;
  return luminance(a) > 0.45 ? DEFAULT_ACCENT : a; // too light for white text on a button
}

export function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** URL to load the logo from (same origin for self-hosted logos, so the PDF can always read it). */
export function logoUrl(b: Brand): string | null {
  const l = (b.logo ?? "").trim();
  if (!l) return null;
  if (/^https:\/\//.test(l)) return l;
  return `${BASE}/${l.replace(/^\/+/, "")}`;
}

const MONO_STOP = new Set(["the", "and", "of", "inc", "ltd", "limited", "corp", "co", "llc", "group"]);
/** Two-letter monogram, e.g. "Hallmark Management Inc." -> "HM", "20|20 Management" -> "20". */
export function monogram(name: string): string {
  const words = name.replace(/&/g, " ").split(/[^A-Za-z0-9]+/).filter((w) => w && !MONO_STOP.has(w.toLowerCase()));
  if (!words.length) return "SL";
  if (/^\d+$/.test(words[0])) return words[0].slice(0, 2);
  return (words[0][0] + (words[1]?.[0] ?? words[0][1] ?? "")).toUpperCase();
}

/** Darker shade of a hex colour (for gradients and pressed states). */
export function shade(hex: string, k = 0.72): string {
  return "#" + hexRgb(hex).map((v) => Math.round(v * k).toString(16).padStart(2, "0")).join("");
}

export const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
