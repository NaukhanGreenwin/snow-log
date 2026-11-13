/* Snow Log report, built on the phone (jsPDF, lazy-loaded). Letter portrait, premium site-service
   report: the company's own logo (self-hosted, same origin, so it always loads), "Prepared for",
   a key-figures strip, clean sections and tables, time-stamped photos, signature. Typeset in
   Instrument Sans (embedded; Helvetica if the font could not be loaded). The footer carries the
   report id only: no dates/URLs/page counters from a browser print, none of that is involved. */
import { jsPDF } from "jspdf";
import type { Visit } from "./types";
import { type Brand, MAKER, accentOf, hexRgb, logoUrl, monogram, shade } from "./brand";
import { fmtClock, fmtDay, fmtStamp, zoneAbbr } from "./time";
import { getPhoto, photoBlob, blobToDataUrl } from "./store";
import { shrinkForPdf } from "./photos";
import { saltFilled } from "./template";

type RGB = [number, number, number];
const INK: RGB = [14, 23, 38];
const INK2: RGB = [51, 65, 85];
const MUTED: RGB = [93, 107, 126];
const RULE: RGB = [226, 230, 236];
const TINT: RGB = [246, 247, 249];
const AMBER: RGB = [181, 105, 8];
const AMBER_T: RGB = [255, 248, 235];

const W = 612, H = 792, M = 44, CW = W - M * 2, FOOT = 40;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const FONTS = { normal: "InstrumentSans-Regular.ttf", medium: "InstrumentSans-Medium.ttf", bold: "InstrumentSans-SemiBold.ttf" } as const;

/** Keep text inside what the fonts can draw (Latin-1 + common punctuation normalised). */
const t = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-").replace(/…/g, "...").replace(/[  ]/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

const fontCache = new Map<string, string>();
async function fontB64(file: string): Promise<string | null> {
  if (fontCache.has(file)) return fontCache.get(file)!;
  try {
    const r = await fetch(`${BASE}/fonts/${file}`);
    if (!r.ok) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    const b = btoa(bin);
    fontCache.set(file, b);
    return b;
  } catch { return null; }
}

/** Fetch fonts + logo once while online so the service worker has them for offline reports. */
export async function warm(brand: Brand) {
  await Promise.all(Object.values(FONTS).map(fontB64));
  const u = logoUrl(brand);
  if (u) await fetch(u).catch(() => {});
}

async function logoPng(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url, { mode: url.startsWith("http") && !url.startsWith(location.origin) ? "cors" : "same-origin" });
    if (!r.ok) return null;
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    try {
      const img = new Image();
      img.src = u;
      await img.decode();
      const scale = Math.min(1, 1000 / img.naturalWidth, 360 / img.naturalHeight) || 1;
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale)); c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/png");
      const out = { data, w: c.width, h: c.height };
      c.width = c.height = 0;
      return out;
    } finally { URL.revokeObjectURL(u); }
  } catch { return null; }
}

function duration(a: string, b: string) {
  if (!/^\d{2}:\d{2}$/.test(a) || !/^\d{2}:\d{2}$/.test(b)) return "";
  let m = (+b.slice(0, 2) * 60 + +b.slice(3)) - (+a.slice(0, 2) * 60 + +a.slice(3));
  if (m < 0) m += 24 * 60;
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h ${r} min` : `${r} min`;
}

const mix = (c: RGB, k: number): RGB => c.map((v) => Math.round(v * k + 255 * (1 - k))) as RGB;

export async function buildPdf(v: Visit, brand: Brand): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const accHex = accentOf(brand);
  const ACC = hexRgb(accHex), ACC2 = hexRgb(shade(accHex, 0.7)), ACC_T = mix(ACC, 0.07), ACC_M = mix(ACC, 0.22);
  const zone = zoneAbbr(v.date);
  doc.setProperties({ title: `Snow Log ${v.id}`, author: brand.name, creator: `Snow Log by ${MAKER}` });

  /* fonts: Instrument Sans if available, Helvetica otherwise */
  let FAM = "helvetica";
  const [fr, fm, fb] = await Promise.all([fontB64(FONTS.normal), fontB64(FONTS.medium), fontB64(FONTS.bold)]);
  if (fr && fb) {
    try {
      doc.addFileToVFS(FONTS.normal, fr); doc.addFont(FONTS.normal, "Inst", "normal");
      doc.addFileToVFS(FONTS.bold, fb); doc.addFont(FONTS.bold, "Inst", "bold");
      if (fm) { doc.addFileToVFS(FONTS.medium, fm); doc.addFont(FONTS.medium, "InstM", "normal"); }
      FAM = "Inst";
    } catch { FAM = "helvetica"; }
  }
  const hasMed = FAM === "Inst" && !!fm;

  let y = M;
  type Wt = "normal" | "medium" | "bold";
  const font = (wt: Wt = "normal", size = 9.5, color: RGB = INK) => {
    if (wt === "medium") { if (hasMed) doc.setFont("InstM", "normal"); else doc.setFont(FAM, "normal"); }
    else doc.setFont(FAM, wt);
    doc.setFontSize(size); doc.setTextColor(...color);
  };
  const bottom = H - M - FOOT;
  const newPage = () => { doc.addPage(); y = M + 8; };
  const ensure = (h: number) => { if (y + h > bottom) { newPage(); return true; } return false; };
  const hline = (yy: number, color: RGB = RULE, w = 0.6, x0 = M, x1 = W - M) => { doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(x0, yy, x1, yy); };
  const lines = (s: string, width: number) => doc.splitTextToSize(t(s), width) as string[];
  const spaced = (s: string, x: number, yy: number, opts: { align?: "left" | "right" | "center"; cs?: number } = {}) => {
    doc.setCharSpace(opts.cs ?? 0.9); doc.text(t(s).toUpperCase(), x, yy, opts.align ? { align: opts.align } : undefined); doc.setCharSpace(0);
  };
  const section = (title: string, keep = 60, extra = "") => {
    ensure(keep + 40);
    y += 18;
    doc.setFillColor(...ACC); doc.roundedRect(M, y - 8.5, 3, 11, 1.5, 1.5, "F");
    font("bold", 11.5, INK); doc.text(t(title), M + 11, y);
    if (extra) { font("normal", 9, MUTED); doc.text(t(extra), W - M, y, { align: "right" }); }
    y += 16;
  };
  const para = (s: string, size = 9.5, color: RGB = INK2, x = M, width = CW, lh = 13.5) => {
    font("normal", size, color);
    for (const l of lines(s, width)) { ensure(lh); doc.text(l, x, y); y += lh; }
  };

  /* ---------- header ---------- */
  doc.setFillColor(...ACC); doc.rect(0, 0, W, 5, "F");
  const logoSrc = logoUrl(brand);
  const logo = logoSrc ? await logoPng(logoSrc) : null;
  const top = 30;
  const LH = 44;
  if (logo) {
    let h = LH, w = (logo.w / logo.h) * h;
    if (w > 210) { w = 210; h = (logo.h / logo.w) * w; }
    if (brand.logoLight) {
      doc.setFillColor(...ACC); doc.roundedRect(M, top, w + 20, h + 14, 7, 7, "F");
      doc.addImage(logo.data, "PNG", M + 10, top + 7, w, h);
    } else {
      doc.addImage(logo.data, "PNG", M, top + (LH - h) / 2 + 2, w, h);
    }
  } else {
    doc.setFillColor(...ACC); doc.roundedRect(M, top + 2, 40, 40, 9, 9, "F");
    font("bold", 15, [255, 255, 255]); doc.text(t(monogram(brand.name)), M + 20, top + 27.5, { align: "center" });
    font("bold", 12.5, INK); doc.text(lines(brand.name, 230)[0], M + 52, top + 26.5);
  }
  font("bold", 7.5, ACC); spaced("Snow clearing and salting log", W - M, top + 12, { align: "right", cs: 1.1 });
  font("normal", 9, INK2); doc.text(`Report ${v.id}`, W - M, top + 27, { align: "right" });
  font("normal", 9, MUTED); doc.text(t(fmtDay(v.date)), W - M, top + 40, { align: "right" });
  y = top + LH + 20;
  hline(y, RULE, 0.7);
  y += 28;

  /* ---------- title block ---------- */
  const signed = !!v.signature;
  const pillW = 78;
  font("medium", 8, MUTED); spaced(`Prepared for ${brand.name}`, M, y, { cs: 0.9 });
  y += 22;
  font("bold", 23, INK);
  const tl = lines(v.property || "Property", CW - pillW - 16).slice(0, 2);
  doc.text(tl, M, y);
  // status pill
  doc.setFillColor(...(signed ? ACC_T : TINT)); doc.setDrawColor(...(signed ? ACC_M : RULE)); doc.setLineWidth(0.6);
  doc.roundedRect(W - M - pillW, y - 14, pillW, 20, 10, 10, "FD");
  if (signed) { doc.setDrawColor(...ACC); doc.setLineWidth(1.3); doc.line(W - M - pillW + 11, y - 4.5, W - M - pillW + 14, y - 1.6); doc.line(W - M - pillW + 14, y - 1.6, W - M - pillW + 19, y - 8); }
  font("bold", 8.5, signed ? ACC : MUTED); doc.text(signed ? "Signed off" : "Not signed", W - M - pillW / 2 + 6, y - 0.5, { align: "center" });
  y += (tl.length - 1) * 26;
  if (v.address) { y += 17; font("normal", 10.5, MUTED); doc.text(lines(v.address, CW)[0], M, y); }
  y += 24;

  /* ---------- key figures ---------- */
  const done = v.areas.filter((a) => a.done);
  const salt = v.salt.filter(saltFilled);
  const saltSum = salt.map((s) => [s.amount, s.amount ? s.unit : ""].filter(Boolean).join(" ")).filter(Boolean).join(" + ") || "None";
  const kpis: [string, string, string][] = [
    ["Time on site", duration(v.start, v.end) || "-", v.start ? `${fmtClock(v.start)} - ${v.end ? fmtClock(v.end) : "..."} ${zone}` : ""],
    ["Areas cleared", `${done.length} of ${v.areas.length}`, v.methods.slice(0, 2).join(", ")],
    ["Salt and sand", saltSum, salt.length ? `${salt.length} product${salt.length > 1 ? "s" : ""}` : "Nothing applied"],
    ["Weather", v.weather.tempC !== "" ? `${v.weather.tempC} °C` : "-", [v.weather.conditions, v.weather.snowCm !== "" ? `${v.weather.snowCm} cm snow` : ""].filter(Boolean).join(", ")],
  ];
  const kg = 8, kw = (CW - kg * 3) / 4, kh = 62;
  kpis.forEach(([k, val, sub], i) => {
    const x = M + i * (kw + kg);
    doc.setFillColor(...(i === 0 ? ACC : TINT)); doc.roundedRect(x, y, kw, kh, 8, 8, "F");
    const on = i === 0;
    font("medium", 7, on ? [255, 255, 255] : MUTED); spaced(k, x + 11, y + 17, { cs: 0.7 });
    font("bold", lines(val, kw - 20).length > 1 || val.length > 13 ? 11 : 14.5, on ? [255, 255, 255] : INK);
    doc.text(lines(val, kw - 20)[0], x + 11, y + 37);
    font("normal", 7.8, on ? mix([255, 255, 255], 0.85) : MUTED); doc.text(lines(sub, kw - 20)[0] ?? "", x + 11, y + 51);
  });
  y += kh + 6;

  /* ---------- details ---------- */
  section("Visit details", 120);
  const det: [string, string][] = [
    ["Visit date", fmtDay(v.date)],
    ["Report ID", v.id],
    ["Started", v.start ? `${fmtClock(v.start)} ${zone}` : "-"],
    ["Finished", v.end ? `${fmtClock(v.end)} ${zone}` : "-"],
    ["Crew", v.crew || "-"],
    ["Method", v.methods.length ? v.methods.join(", ") : "-"],
    ["Location", v.gps ? `${v.gps.lat.toFixed(5)}, ${v.gps.lon.toFixed(5)} (within ${v.gps.acc} m)` : "Not recorded"],
    ["Signed off by", [v.signName, v.signRole].filter(Boolean).join(", ") || "-"],
  ];
  const colW = (CW - 24) / 2, keyW = 74;
  {
    // measure, then draw a soft box behind the grid
    font("normal", 9.5);
    const rows: number[] = [];
    for (let i = 0; i < det.length; i += 2) rows.push(Math.max(...det.slice(i, i + 2).map(([, val]) => lines(val || "-", colW - keyW - 12).length)) * 12.5 + 12);
    const boxH = rows.reduce((a, b) => a + b, 0) + 8;
    ensure(boxH);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.roundedRect(M, y - 4, CW, boxH, 8, 8, "S");
    let yy = y + 13;
    rows.forEach((rh, r) => {
      det.slice(r * 2, r * 2 + 2).forEach(([k, val], j) => {
        const x = M + 12 + j * (colW + 24);
        font("normal", 8.5, MUTED); doc.text(t(k), x, yy);
        font("medium", 9.5, INK); doc.text(lines(val || "-", colW - keyW - 12), x + keyW, yy);
      });
      if (r < rows.length - 1) hline(yy + rh - 13.5, RULE, 0.4, M + 12, W - M - 12);
      yy += rh;
    });
    y += boxH + 2;
  }

  /* ---------- areas ---------- */
  const notDone = v.areas.filter((a) => !a.done);
  section("Areas cleared", 90, `${done.length} of ${v.areas.length}`);
  const half = Math.ceil(v.areas.length / 2);
  const colA = v.areas.slice(0, half), colB = v.areas.slice(half);
  const aw = (CW - 12) / 2;
  for (let i = 0; i < half; i++) {
    ensure(24);
    [colA[i], colB[i]].forEach((a, j) => {
      if (!a) return;
      const x = M + j * (aw + 12);
      doc.setFillColor(...(a.done ? ACC_T : [255, 255, 255] as RGB)); doc.setDrawColor(...(a.done ? ACC_M : RULE)); doc.setLineWidth(0.6);
      doc.roundedRect(x, y - 13, aw, 20, 6, 6, "FD");
      const cx = x + 13, cy = y - 3;
      if (a.done) {
        doc.setFillColor(...ACC); doc.circle(cx, cy, 5.2, "F");
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(1.2); doc.line(cx - 2.4, cy + 0.1, cx - 0.6, cy + 1.9); doc.line(cx - 0.6, cy + 1.9, cx + 2.6, cy - 1.9);
      } else { doc.setDrawColor(...RULE); doc.setLineWidth(1); doc.circle(cx, cy, 5, "S"); }
      font(a.done ? "medium" : "normal", 9.5, a.done ? INK : MUTED);
      doc.text(lines(a.label, aw - 90)[0], x + 25, y + 0.5);
      font("normal", 8, a.done ? ACC : MUTED);
      doc.text(a.done ? "Cleared" : "Not cleared", x + aw - 10, y + 0.5, { align: "right" });
    });
    y += 25;
  }
  if (notDone.length && done.length) { y += 1; para(`Not cleared on this visit: ${notDone.map((a) => a.label.toLowerCase()).join(", ")}.`, 8.5, MUTED); }

  /* ---------- salt ---------- */
  section("Salt, ice melt and sand", 70);
  if (!salt.length) para("No salt, ice melt or sand was applied on this visit.");
  else {
    const cols = [{ h: "Product", w: 190 }, { h: "Amount", w: 100 }, { h: "Where applied", w: CW - 290 }];
    doc.setFillColor(...TINT); doc.roundedRect(M, y - 12, CW, 21, 6, 6, "F");
    let x = M + 12; font("medium", 7.2, MUTED);
    cols.forEach((c) => { spaced(c.h, x, y + 1.5, { cs: 0.7 }); x += c.w; });
    y += 25;
    salt.forEach((s, r) => {
      const cells = [s.product || "-", [s.amount, s.amount ? s.unit : ""].filter(Boolean).join(" ") || "-", s.areas || "-"];
      font("normal", 9.5, INK);
      const ls = cells.map((c, i) => lines(i === 2 ? c.charAt(0).toUpperCase() + c.slice(1) : c, cols[i].w - 16));
      const h = Math.max(...ls.map((l) => l.length)) * 12.5 + 10;
      ensure(h);
      x = M + 12;
      ls.forEach((l, i) => { font(i === 0 ? "medium" : "normal", 9.5, i === 2 ? INK2 : INK); doc.text(l, x, y); x += cols[i].w; });
      y += h;
      if (r < salt.length - 1) hline(y - 13, RULE, 0.4);
    });
    y -= 4;
  }

  /* ---------- weather ---------- */
  section("Weather at the visit", 80, v.weather.source === "open-meteo" ? "Open-Meteo, GPS location" : "Entered on site");
  const wx: [string, string][] = [
    ["Temperature", v.weather.tempC !== "" ? `${v.weather.tempC} °C` : "-"],
    ["Conditions", v.weather.conditions || "-"],
    ["Snowfall, 12 h", v.weather.snowCm !== "" ? `${v.weather.snowCm} cm` : "-"],
    ["Wind", v.weather.wind !== "" ? `${v.weather.wind} km/h` : "-"],
  ];
  ensure(50);
  doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.roundedRect(M, y - 6, CW, 46, 8, 8, "S");
  const cw4 = CW / 4;
  wx.forEach(([k, val], i) => {
    const x = M + i * cw4 + 14;
    if (i) { doc.setDrawColor(...RULE); doc.setLineWidth(0.5); doc.line(M + i * cw4, y + 2, M + i * cw4, y + 32); }
    font("medium", 7, MUTED); spaced(k, x, y + 9, { cs: 0.7 });
    font("bold", 12.5, INK); doc.text(lines(val, cw4 - 24)[0], x, y + 27);
  });
  y += 52;
  if (v.weather.source === "open-meteo") para(`Retrieved ${fmtStamp(v.weather.fetchedAt)} for the GPS location of the visit.`, 8.3, MUTED);

  /* ---------- hazards and notes ---------- */
  const callout = (title: string, body: string, fill: RGB, bar: RGB, titleColor: RGB) => {
    font("normal", 9.5);
    const ls = lines(body, CW - 34);
    const h = ls.length * 13.5 + 32;
    ensure(Math.min(h, 120));
    const y0 = y;
    doc.setFillColor(...fill); doc.roundedRect(M, y0, CW, h, 8, 8, "F");
    doc.setFillColor(...bar); doc.roundedRect(M, y0, 3.5, h, 1.75, 1.75, "F");
    font("bold", 9, titleColor); doc.text(t(title), M + 17, y0 + 17);
    y = y0 + 32;
    font("normal", 9.5, INK2);
    for (const l of ls) { if (ensure(13.5)) font("normal", 9.5, INK2); doc.text(l, M + 17, y); y += 13.5; }
    y += 8;
  };
  if (v.hazards.trim() || v.notes.trim()) {
    section("Hazards and notes", 70);
    y -= 6;
    if (v.hazards.trim()) callout("Hazards reported", v.hazards, AMBER_T, [245, 158, 11], AMBER);
    if (v.notes.trim()) callout("Crew notes", v.notes, TINT, RULE.map((c) => c - 30) as RGB, INK);
  }

  /* ---------- sign-off ---------- */
  section("Sign-off", 150);
  para(`I confirm that the work recorded above was carried out at ${v.property || "this property"} on ${fmtDay(v.date)}, at the times shown.`, 9.5, INK2);
  y += 8;
  if (v.signature) {
    ensure(96);
    const sw = 250, sh = 84;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.7); doc.roundedRect(M, y, sw, sh, 8, 8, "S");
    try { doc.addImage(v.signature, "PNG", M + 6, y + 4, sw - 12, sh - 12); } catch { /* bad image */ }
    const x = M + sw + 22;
    font("medium", 7, MUTED); spaced("Signed by", x, y + 16, { cs: 0.7 });
    font("bold", 11.5, INK); doc.text(lines(v.signName || "-", CW - sw - 30)[0], x, y + 32);
    font("normal", 9.5, INK2); doc.text(lines(v.signRole || "", CW - sw - 30)[0] ?? "", x, y + 46);
    font("normal", 8.5, MUTED); doc.text(t(`Signed ${fmtStamp(v.signedAt)}`), x, y + 64);
    if (v.gps) doc.text(t(`At ${v.gps.lat.toFixed(5)}, ${v.gps.lon.toFixed(5)}`), x, y + 76);
    y += sh + 6;
  } else para("Not signed.", 9.5, MUTED);

  /* ---------- photos ---------- */
  const shots = v.photos.slice().sort((a, b) => (a.kind === b.kind ? a.takenAt.localeCompare(b.takenAt) : a.kind === "before" ? -1 : 1));
  if (shots.length) {
    const gap = 14, pw = (CW - gap) / 2, ph = pw * 0.75;
    section("Site photos", ph + 30, `${shots.length} photo${shots.length > 1 ? "s" : ""}, time-stamped in the app`);
    y -= 4;
    for (let i = 0; i < shots.length; i += 2) {
      ensure(ph + 34);
      for (let j = 0; j < 2 && i + j < shots.length; j++) {
        const s = shots[i + j], x = M + j * (pw + gap);
        doc.setFillColor(...TINT); doc.rect(x, y, pw, ph, "F");
        const rec = await getPhoto(s.id).catch(() => undefined);
        const b = rec && photoBlob(rec);
        if (rec && b) {
          const small = await shrinkForPdf(b, 1200, 0.62);
          const data = await blobToDataUrl(small);
          const k = Math.max(pw / rec.w, ph / rec.h); // cover the frame, crop centred
          const iw = rec.w * k, ih = rec.h * k;
          if (Math.abs(iw - pw) < 1 && Math.abs(ih - ph) < 1) doc.addImage(data, "JPEG", x, y, pw, ph, undefined, "FAST");
          else {
            // clip to the frame so cover-cropping never spills outside it
            doc.saveGraphicsState();
            doc.rect(x, y, pw, ph, null); doc.clip(); doc.discardPath();
            doc.addImage(data, "JPEG", x + (pw - iw) / 2, y + (ph - ih) / 2, iw, ih, undefined, "FAST");
            doc.restoreGraphicsState();
          }
        }
        // rounded-corner mask: white quarter-rings over the photo corners
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(6);
        doc.roundedRect(x - 3, y - 3, pw + 6, ph + 6, 9, 9, "S");
        // kind tag
        const tag = s.kind === "before" ? "BEFORE" : "AFTER";
        font("bold", 6.8, [255, 255, 255]); doc.setCharSpace(0.8);
        const tw = doc.getTextWidth(tag) + 14;
        doc.setFillColor(...(s.kind === "before" ? INK : ACC2)); doc.roundedRect(x + 8, y + 8, tw, 15, 7.5, 7.5, "F");
        doc.text(tag, x + 15, y + 18.2); doc.setCharSpace(0);
        font("medium", 8.5, INK); doc.text(`Photo ${i + j + 1}`, x, y + ph + 15);
        font("normal", 8.5, MUTED); doc.text(t(fmtStamp(s.takenAt)), x + pw, y + ph + 15, { align: "right" });
      }
      y += ph + 30;
    }
  }

  /* ---------- footer on every page (report id only; no page counters) ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    if (p > 1) { doc.setFillColor(...ACC); doc.rect(0, 0, W, 5, "F"); }
    const fy = H - M + 4;
    hline(fy - 14, RULE, 0.6);
    font("medium", 7.5, INK2);
    doc.text(lines(`${v.property || ""}  ·  ${fmtDay(v.date, false)}  ·  Report ${v.id}`, CW - 150)[0], M, fy);
    font("normal", 7.5, MUTED);
    doc.text(`Snow Log by ${MAKER}`, W - M, fy, { align: "right" });
    doc.text(lines(`Record of snow and ice control made on site during the visit. Times are Mountain Time from the device; photos are time-stamped when taken in the app.`, CW)[0], M, fy + 11);
  }

  return doc.output("blob");
}
