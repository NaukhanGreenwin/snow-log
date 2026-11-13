import type { Area, SaltEntry, Visit } from "./types";
import type { Brand } from "./brand";
import { siteDate, siteTime, uid } from "./time";

export const DEFAULT_AREAS: [string, string][] = [
  ["walkways", "Walkways and sidewalks"],
  ["entrances", "Entrances and landings"],
  ["stairs", "Stairs"],
  ["ramps", "Ramps"],
  ["parking", "Parking lot"],
  ["aisles", "Drive aisles"],
  ["fireexits", "Fire exits"],
  ["garbage", "Garbage area"],
  ["mailboxes", "Mailboxes"],
];

export const METHODS = ["Shovel", "Plow", "Snow blower", "Broom", "Ice chipper"];
export const PRODUCTS = ["Rock salt", "Treated salt", "Ice melt (calcium chloride)", "Ice melt (magnesium chloride)", "Sand", "Sand and salt mix", "Grit"];
export const UNITS = ["kg", "bags (20 kg)", "pails", "scoops", "lb"];

const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function reportId(d = new Date()) {
  const ymd = siteDate(d).replace(/-/g, "").slice(2);
  let s = "";
  const r = crypto.getRandomValues(new Uint8Array(4));
  r.forEach((b) => (s += ALPHA[b % ALPHA.length]));
  return `SL-${ymd}-${s}`;
}

export const newSalt = (): SaltEntry => ({ id: uid("s"), product: "", amount: "", unit: "kg", areas: "" });

export function newVisit(b: Brand, prefill = true): Visit {
  const now = new Date();
  const iso = now.toISOString();
  return {
    v: 1,
    id: reportId(now),
    brand: b.slug,
    createdAt: iso,
    updatedAt: iso,
    completedAt: "",
    property: prefill ? b.sampleProperty ?? "" : "",
    address: prefill ? b.sampleAddress ?? "" : "",
    date: siteDate(now),
    start: siteTime(now),
    end: "",
    crew: "",
    areas: DEFAULT_AREAS.map(([key, label]): Area => ({ key, label, done: false })),
    methods: [],
    salt: [newSalt()],
    weather: { tempC: "", conditions: "", snowCm: "", wind: "", source: "", fetchedAt: "" },
    gps: null,
    photos: [],
    hazards: "",
    notes: "",
    signName: "",
    signRole: "",
    signature: "",
    signedAt: "",
  };
}

export const saltFilled = (s: SaltEntry) => !!(s.product.trim() || s.amount.trim());

export function pdfFileName(v: Visit) {
  const place = (v.property || "Site").replace(/[^A-Za-z0-9 \-]/g, "").replace(/\s+/g, " ").trim().slice(0, 48);
  return `Snow Log - ${place} - ${v.date}.pdf`;
}
