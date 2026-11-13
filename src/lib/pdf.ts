/* Snow Log report, built on the phone (jsPDF, lazy-loaded). Letter portrait, white paper, text-first
   tables, photos two per row with their time stamps, signature, and a footer on every page that
   carries the report id and the record statement. No browser print header/footer is involved. */
import { jsPDF } from "jspdf";
import type { Visit } from "./types";
import { type Brand, MAKER, accentOf, hexRgb } from "./brand";
import { fmtClock, fmtDay, fmtStamp, zoneAbbr } from "./time";
import { getPhoto, photoBlob, blobToDataUrl } from "./store";
import { shrinkForPdf } from "./photos";
import { saltFilled } from "./template";

type RGB = [number, number, number];
const INK: RGB = [22, 25, 31];
const MUTED: RGB = [88, 94, 104];
const RULE: RGB = [214, 218, 223];
const TINT: RGB = [244, 245, 247];

const W = 612, H = 792, M = 48, CW = W - M * 2, FOOT = 46;

/** jsPDF core fonts are WinAnsi: normalise typography and drop anything they can't draw. */
const t = (s: string | undefined | null) =>
  String(s ?? "")
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-").replace(/…/g, "...").replace(/ | /g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, "");

async function logoPng(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const r = await fetch(url, { mode: "cors" });
    if (!r.ok) return null;
    const b = await r.blob();
    const u = URL.createObjectURL(b);
    try {
      const img = new Image();
      img.src = u;
      await img.decode();
      const scale = Math.min(1, 900 / img.naturalWidth);
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

export async function buildPdf(v: Visit, brand: Brand): Promise<Blob> {
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });
  const ACC = hexRgb(accentOf(brand));
  const zone = zoneAbbr(v.date);
  doc.setProperties({ title: `Snow Log ${v.id}`, author: brand.name, creator: `Snow Log by ${MAKER}` });
  let y = M;

  const font = (style: "normal" | "bold" | "italic" = "normal", size = 9.5, color: RGB = INK, family = "helvetica") => { doc.setFont(family, style); doc.setFontSize(size); doc.setTextColor(...color); };
  const ensure = (h: number) => { if (y + h > H - M - FOOT) { doc.addPage(); y = M; return true; } return false; };
  const rule = (yy: number, color: RGB = RULE, w = 0.6) => { doc.setDrawColor(...color); doc.setLineWidth(w); doc.line(M, yy, W - M, yy); };
  const lines = (s: string, width: number) => doc.splitTextToSize(t(s), width) as string[];
  const section = (s: string, keep = 60) => {
    ensure(keep + 34);
    y += 14;
    font("bold", 11, INK); doc.text(t(s), M, y);
    y += 6; rule(y, ACC, 1); y += 16;
  };
  const para = (s: string, size = 9.5, color: RGB = INK) => {
    font("normal", size, color);
    for (const l of lines(s, CW)) { ensure(13); doc.text(l, M, y); y += 13; }
  };

  /* ---------- header ---------- */
  const logo = brand.logo ? await logoPng(brand.logo) : null;
  if (logo) {
    const h = 34, w = Math.min(180, (logo.w / logo.h) * h);
    doc.addImage(logo.data, "PNG", M, y - 8, w, (w / logo.w) * logo.h);
  } else {
    font("bold", 14, ACC); doc.text(lines(brand.name, CW / 2 + 40)[0], M, y + 8);
  }
  font("bold", 8, MUTED); doc.setCharSpace(0.9);
  doc.text("SNOW CLEARING AND SALTING LOG", W - M, y + 2, { align: "right" }); doc.setCharSpace(0);
  font("normal", 9, INK); doc.text(`Report ${v.id}`, W - M, y + 15, { align: "right" });
  y += 34;
  rule(y, ACC, 1.6);
  y += 30;
  font("normal", 21, INK, "times");
  const tl = lines(v.property || "Property", CW).slice(0, 2);
  doc.setFont("times", "normal"); doc.text(tl, M, y);
  y += tl.length * 23 - 6;
  if (v.address) { y += 10; font("normal", 10.5, MUTED); doc.text(lines(v.address, CW)[0], M, y); }
  y += 22;

  /* ---------- details ---------- */
  const det: [string, string][] = [
    ["Visit date", fmtDay(v.date)],
    ["Report ID", v.id],
    ["Started", v.start ? `${fmtClock(v.start)} ${zone}` : "-"],
    ["Finished", v.end ? `${fmtClock(v.end)} ${zone}` : "-"],
    ["Time on site", duration(v.start, v.end) || "-"],
    ["Crew", v.crew || "-"],
    ["Method", v.methods.length ? v.methods.join(", ") : "-"],
    ["Location", v.gps ? `${v.gps.lat.toFixed(5)}, ${v.gps.lon.toFixed(5)} (within ${v.gps.acc} m), ${fmtStamp(v.gps.at)}` : "Not recorded"],
    ["Prepared for", brand.name],
    ["Signed off by", [v.signName, v.signRole].filter(Boolean).join(", ") || "-"],
  ];
  const colW = CW / 2 - 10, keyW = 78;
  rule(y - 12);
  for (let i = 0; i < det.length; i += 2) {
    const pair = det.slice(i, i + 2);
    font("normal", 9.5, INK);
    const h = Math.max(...pair.map(([, val]) => lines(val || "-", colW - keyW).length)) * 12 + 9;
    ensure(h);
    pair.forEach(([k, val], j) => {
      const x = M + j * (colW + 20);
      font("normal", 8.5, MUTED); doc.text(t(k), x, y);
      font("normal", 9.5, INK); doc.text(lines(val || "-", colW - keyW), x + keyW, y);
    });
    y += h;
    doc.setDrawColor(...RULE); doc.setLineWidth(0.4); doc.line(M, y - 9, W - M, y - 9);
  }

  /* ---------- areas ---------- */
  const done = v.areas.filter((a) => a.done);
  const notDone = v.areas.filter((a) => !a.done);
  section(`Areas cleared (${done.length} of ${v.areas.length})`, 80);
  const half = Math.ceil(v.areas.length / 2);
  const colA = v.areas.slice(0, half), colB = v.areas.slice(half);
  for (let i = 0; i < half; i++) {
    ensure(16);
    [colA[i], colB[i]].forEach((a, j) => {
      if (!a) return;
      const x = M + j * (CW / 2);
      doc.setDrawColor(...(a.done ? ACC : RULE)); doc.setLineWidth(0.9);
      doc.rect(x, y - 8, 9, 9, a.done ? "S" : "S");
      if (a.done) { doc.setDrawColor(...ACC); doc.setLineWidth(1.3); doc.line(x + 2, y - 3.5, x + 4, y - 1.2); doc.line(x + 4, y - 1.2, x + 7.4, y - 6.4); }
      font("normal", 9.5, a.done ? INK : MUTED);
      doc.text(t(a.label), x + 16, y);
      font("normal", 8.5, MUTED);
      doc.text(a.done ? "Cleared" : "Not cleared", x + CW / 2 - 16, y, { align: "right" });
    });
    y += 16;
  }
  if (notDone.length && done.length) { y += 2; para(`Not cleared on this visit: ${notDone.map((a) => a.label.toLowerCase()).join(", ")}.`, 8.5, MUTED); }

  /* ---------- salt ---------- */
  const salt = v.salt.filter(saltFilled);
  section("Salt, ice melt and sand", 60);
  if (!salt.length) para("No salt, ice melt or sand was applied on this visit.");
  else {
    const cols = [{ h: "Product", w: 190 }, { h: "Amount", w: 100 }, { h: "Where applied", w: CW - 290 }];
    doc.setFillColor(...TINT); doc.rect(M, y - 10, CW, 16, "F");
    let x = M + 6; font("bold", 7.5, MUTED);
    cols.forEach((c) => { doc.text(c.h.toUpperCase(), x, y); x += c.w; });
    y += 16;
    for (const s of salt) {
      const cells = [s.product || "-", [s.amount, s.amount ? s.unit : ""].filter(Boolean).join(" ") || "-", s.areas || "-"];
      const ls = cells.map((c, i) => lines(c, cols[i].w - 10));
      const h = Math.max(...ls.map((l) => l.length)) * 12 + 6;
      ensure(h);
      x = M + 6; font("normal", 9.5, INK);
      ls.forEach((l, i) => { doc.text(l, x, y); x += cols[i].w; });
      y += h; rule(y - 9, RULE, 0.4);
    }
  }

  /* ---------- weather ---------- */
  section("Weather at the visit", 60);
  const wx: [string, string][] = [
    ["Temperature", v.weather.tempC !== "" ? `${v.weather.tempC} °C` : "-"],
    ["Conditions", v.weather.conditions || "-"],
    ["Snowfall, last 12 h", v.weather.snowCm !== "" ? `${v.weather.snowCm} cm` : "-"],
    ["Wind", v.weather.wind !== "" ? `${v.weather.wind} km/h` : "-"],
  ];
  const cw4 = CW / 4;
  wx.forEach(([k, val], i) => {
    const x = M + i * cw4;
    font("normal", 8, MUTED); doc.text(t(k), x, y);
    font("normal", 12, INK); doc.text(t(val), x, y + 16);
  });
  y += 34;
  para(v.weather.source === "open-meteo"
    ? `Source: Open-Meteo weather data for the GPS location above, retrieved ${fmtStamp(v.weather.fetchedAt)}.`
    : "Source: entered by the crew on site.", 8.5, MUTED);

  /* ---------- hazards and notes ---------- */
  if (v.hazards.trim() || v.notes.trim()) {
    section("Hazards and notes", 50);
    if (v.hazards.trim()) { font("bold", 9.5, INK); ensure(14); doc.text("Hazards reported", M, y); y += 13; para(v.hazards); y += 4; }
    if (v.notes.trim()) { font("bold", 9.5, INK); ensure(14); doc.text("Notes", M, y); y += 13; para(v.notes); }
  }

  /* ---------- sign-off ---------- */
  section("Sign-off", 150);
  para(`I confirm that the work recorded above was carried out at ${v.property || "this property"} on ${fmtDay(v.date)}, at the times shown.`);
  y += 6;
  if (v.signature) {
    ensure(80);
    doc.setDrawColor(...RULE); doc.setLineWidth(0.6); doc.rect(M, y, 240, 70);
    try { doc.addImage(v.signature, "PNG", M + 4, y + 4, 232, 62); } catch { /* bad image */ }
    font("normal", 9.5, INK);
    doc.text(t([v.signName, v.signRole].filter(Boolean).join(", ") || "-"), M + 260, y + 22);
    font("normal", 8.5, MUTED);
    doc.text(t(`Signed ${fmtStamp(v.signedAt)}`), M + 260, y + 36);
    y += 84;
  } else para("Not signed.", 9.5, MUTED);

  /* ---------- photos ---------- */
  const shots = v.photos.slice().sort((a, b) => (a.kind === b.kind ? a.takenAt.localeCompare(b.takenAt) : a.kind === "before" ? -1 : 1));
  if (shots.length) {
    doc.addPage(); y = M + 4;
    font("bold", 11, INK); doc.text(`Photos (${shots.length})`, M, y); y += 6; rule(y, ACC, 1); y += 18;
    const gap = 14, pw = (CW - gap) / 2, ph = pw * 0.75;
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
          const k = Math.min(pw / rec.w, ph / rec.h);
          const iw = rec.w * k, ih = rec.h * k;
          doc.addImage(data, "JPEG", x + (pw - iw) / 2, y + (ph - ih) / 2, iw, ih, undefined, "FAST");
        }
        font("bold", 8.5, INK); doc.text(`P${i + j + 1}  ${s.kind === "before" ? "Before" : "After"}`, x, y + ph + 13);
        font("normal", 8.5, MUTED); doc.text(t(fmtStamp(s.takenAt)), x + pw, y + ph + 13, { align: "right" });
      }
      y += ph + 30;
    }
  }

  /* ---------- footer on every page ---------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    const fy = H - M + 6;
    rule(fy - 16, RULE, 0.5);
    font("normal", 7.5, MUTED);
    doc.text(lines(`Report ${v.id}  |  ${v.property || ""}  |  ${fmtDay(v.date, false)}`, CW - 80)[0], M, fy - 4);
    doc.text(`Page ${p} of ${pages}`, W - M, fy - 4, { align: "right" });
    doc.text(lines(`Record of snow and ice control, made on site during the visit. Times are Mountain Time from the device; photos are time-stamped when taken in the app. Prepared with Snow Log by ${MAKER}.`, CW), M, fy + 7);
  }

  return doc.output("blob");
}
