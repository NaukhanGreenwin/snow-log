/* One deployment, many companies: ?c=<slug> picks the brand from src/brands.json (added with
   scripts/add_brands.py). The chosen slug is remembered on the phone so the home-screen icon and
   offline reloads keep the same brand. No slug = the IT Rapid Support demo brand. */
import brands from "../brands.json";

export interface Brand {
  slug: string;
  name: string;
  /** optional https logo; falls back to the company name in type */
  logo?: string;
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

export const hexRgb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
