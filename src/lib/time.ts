/* All times on screen and in the report are site time: Alberta, America/Edmonton (MST/MDT). */
export const TZ = "America/Edmonton";

let seq = 0;
export const uid = (p = "") => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function parts(d: Date) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(d)) o[p.type] = p.value;
  return o;
}
/** YYYY-MM-DD in site time */
export const siteDate = (d = new Date()) => { const o = parts(d); return `${o.year}-${o.month}-${o.day}`; };
/** HH:MM (24 h) in site time */
export const siteTime = (d = new Date()) => { const o = parts(d); return `${o.hour}:${o.minute}`; };

/** "8:42 a.m." from "08:42" */
export function fmtClock(hhmm: string) {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return "";
  let h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3);
  const ap = h < 12 ? "a.m." : "p.m.";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}
/** "Saturday, December 12, 2026" from "2026-12-12" */
export function fmtDay(ymd: string, long = true) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const d = new Date(`${ymd}T12:00:00Z`);
  return d.toLocaleDateString("en-CA", { timeZone: "UTC", weekday: long ? "long" : undefined, month: long ? "long" : "short", day: "numeric", year: "numeric" });
}
/** "Dec 12, 2026, 7:14 a.m. MST" from an ISO instant */
export function fmtStamp(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(+d)) return "";
  return d.toLocaleString("en-CA", { timeZone: TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}
/** "7:14 a.m." from an ISO instant */
export function fmtStampTime(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-CA", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}
/** Zone abbreviation for a site date (MST in winter, MDT in summer) */
export function zoneAbbr(ymd: string) {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? new Date(`${ymd}T18:00:00Z`) : new Date();
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, timeZoneName: "short" }).formatToParts(d).find((x) => x.type === "timeZoneName");
  return p?.value ?? "MT";
}
