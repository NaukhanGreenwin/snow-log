// Step 2 of the logo pipeline: download each company's logo candidates, render them in Chromium,
// trim, judge (size, light-on-transparent), and write public/logos/<slug>.png + logos-manifest.json.
//   node scripts/logos/process.mjs <workdir>      (workdir = the one scrape.py wrote)
// Choice order: header logo found by Firecrawl branding > apple-touch / large icon > favicon >= 96 px.
// No usable image -> the app and the PDF draw a monogram in the company accent colour.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const WORK = path.resolve(process.argv[2] ?? "/tmp/sl-logos");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUTDIR = path.join(ROOT, "public/logos");
fs.mkdirSync(OUTDIR, { recursive: true });
fs.mkdirSync(path.join(WORK, "dl"), { recursive: true });
const jobs = JSON.parse(fs.readFileSync(path.join(WORK, "jobs.json"), "utf8"));
const only = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
const OV = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts/logos/overrides.json"), "utf8"));
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const abs = (u, base) => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; } };
function upgrade(u) {
  // Wix serves resized copies; the original is the part before /v1/
  if (/static\.wixstatic\.com\/media\//.test(u) && u.includes("/v1/")) return [u.split("/v1/")[0], u];
  return [u];
}
function candidates(raw, site) {
  const out = [];
  const b = raw.branding ?? {};
  const logo = b.logo || b.images?.logo;
  if (logo && !/^data:/.test(logo)) upgrade(abs(logo, site) ?? "").forEach((u) => u && out.push({ u, kind: "logo" }));
  for (const tag of raw.logoImgs ?? []) {
    const m = tag.match(/\bsrc=["']([^"']+)["']/i); if (!m || /^data:/.test(m[1])) continue;
    const u = abs(m[1], site); if (u) upgrade(u).forEach((x) => out.push({ u: x, kind: "logo-img" }));
  }
  const icons = (raw.iconTags ?? []).map((tag) => {
    const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
    const sizes = +(tag.match(/sizes=["'](\d+)x/i)?.[1] ?? 0);
    const apple = /apple-touch/i.test(tag);
    return href && !/^data:/.test(href) ? { u: abs(href, site), kind: apple ? "touch-icon" : "icon", sizes: sizes || (apple ? 180 : 0) } : null;
  }).filter(Boolean).sort((a, b) => b.sizes - a.sizes);
  for (const i of icons) if (i.u) upgrade(i.u).forEach((x) => out.push({ u: x, kind: i.kind }));
  const fav = raw.metadata?.favicon || b.images?.favicon;
  if (fav) { const u = abs(fav, site); if (u) out.push({ u, kind: "favicon" }); }
  try { out.push({ u: new URL("/apple-touch-icon.png", site).href, kind: "touch-icon" }); } catch {}
  const seen = new Set();
  return out.filter((c) => c.u && !seen.has(c.u) && seen.add(c.u) && !/parastorage\.com\/client\/pfavico/.test(c.u));
}

async function download(u) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(u, { headers: { "User-Agent": UA, Accept: "image/avif,image/webp,image/png,image/svg+xml,image/*,*/*;q=0.8" }, signal: ctl.signal, redirect: "follow" });
    if (!r.ok) return null;
    const type = (r.headers.get("content-type") || "").split(";")[0].trim();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 100 || buf.length > 8e6) return null;
    let mime = type.startsWith("image/") ? type : "";
    const head = buf.subarray(0, 300).toString("latin1");
    if (!mime) mime = /<svg/i.test(head) ? "image/svg+xml" : buf[0] === 0x89 ? "image/png" : buf[0] === 0xff ? "image/jpeg" : /ftypavif/.test(head) ? "image/avif" : /WEBP/.test(head) ? "image/webp" : buf[0] === 0 && buf[2] === 1 ? "image/x-icon" : "";
    if (!mime || /text\/html/.test(type)) return null;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch { return null; } finally { clearTimeout(t); }
}

// runs in the page: decode, rasterise (SVG at 4x), detect background, trim, measure
const ANALYSE = async (src) => {
  const img = new Image(); img.src = src;
  try { await img.decode(); } catch { return { err: "decode" }; }
  let w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) { w = 600; h = 200; }
  const isSvg = src.startsWith("data:image/svg");
  const k = isSvg ? Math.min(8, 1200 / Math.max(w, h)) : 1;
  const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(img, 0, 0, c.width, c.height);
  const { data } = g.getImageData(0, 0, c.width, c.height); const W = c.width, H = c.height;
  const px = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; };
  const corners = [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1)];
  const transparentBg = corners.filter((p) => p[3] < 30).length >= 3;
  const bg = corners[0];
  const near = (p, q, tol) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < tol;
  const uniformBg = !transparentBg && corners.every((p) => near(p, bg, 40) && p[3] > 200);
  const isBg = (p) => transparentBg ? p[3] < 30 : uniformBg ? near(p, bg, 48) : false;
  let x0 = W, y0 = H, x1 = -1, y1 = -1, n = 0, lum = 0, sat = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = px(x, y); if (isBg(p)) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (p[3] > 128) { n++; lum += (0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]) / 255; sat += (Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])) / 255; }
  }
  if (x1 < 0) return { err: "blank", W, H };
  const bgLum = (0.2126 * bg[0] + 0.7152 * bg[1] + 0.0722 * bg[2]) / 255;
  const pad = 0;
  const tw = x1 - x0 + 1 + pad * 2, th = y1 - y0 + 1 + pad * 2;
  const scale = Math.min(1, 900 / tw, 300 / th);
  const o = document.createElement("canvas"); o.width = Math.max(1, Math.round(tw * scale)); o.height = Math.max(1, Math.round(th * scale));
  const og = o.getContext("2d"); og.imageSmoothingQuality = "high";
  og.drawImage(c, x0 - pad, y0 - pad, tw, th, 0, 0, o.width, o.height);
  return {
    W, H, tw, th, outW: o.width, outH: o.height, isSvg,
    bg: transparentBg ? "transparent" : uniformBg ? (bgLum > 0.92 ? "white" : "solid") : "image",
    bgHex: "#" + [bg[0], bg[1], bg[2]].map((v) => v.toString(16).padStart(2, "0")).join(""),
    fgLum: n ? lum / n : 0, fgSat: n ? sat / n : 0, fill: n / (tw * th),
    png: o.toDataURL("image/png"),
  };
};

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent("<html><body></body></html>");
const manifest = [];
let i = 0;
for (const j of jobs) {
  i++;
  if (only && !only.has(j.slug)) continue;
  const rawPath = path.join(WORK, "raw", `${j.slug}.json`);
  const raw = fs.existsSync(rawPath) ? JSON.parse(fs.readFileSync(rawPath, "utf8")) : null;
  const entry = { slug: j.slug, name: j.name, website: j.website, source: null, kind: "monogram", file: null, primary: raw?.branding?.colors?.primary ?? null, tried: [] };
  const ov = OV[j.slug] ?? {};
  if (ov.monogram) entry.tried.push(`override: ${ov.why}`);
  if (raw && j.website && !ov.monogram) {
    const cands = ov.source ? [{ u: ov.source, kind: "logo" }] : candidates(raw, j.website).slice(0, 8);
    for (const c of cands) {
      const src = await download(c.u);
      if (!src) { entry.tried.push(`${c.kind}: download failed`); continue; }
      const a = await page.evaluate(ANALYSE, src).catch((e) => ({ err: String(e).slice(0, 80) }));
      if (a.err) { entry.tried.push(`${c.kind}: ${a.err}`); continue; }
      const big = Math.max(a.tw, a.th);
      const minSize = c.kind === "favicon" || c.kind === "icon" ? 96 : 40;
      if (big < minSize && !a.isSvg) { entry.tried.push(`${c.kind}: too small ${a.tw}x${a.th}`); continue; }
      if (a.bg === "image" && c.kind !== "logo" && c.kind !== "touch-icon") { entry.tried.push(`${c.kind}: busy background`); continue; }
      const file = `${j.slug}.png`;
      fs.writeFileSync(path.join(OUTDIR, file), Buffer.from(a.png.split(",")[1], "base64"));
      Object.assign(entry, {
        source: c.u, kind: c.kind, file, w: a.outW, h: a.outH, bg: a.bg, bgHex: a.bgHex,
        light: !!ov.light || (a.bg === "transparent" && a.fgLum > 0.8), fgLum: +a.fgLum.toFixed(3),
      });
      break;
    }
  }
  manifest.push(entry);
  console.log(`${i}/${jobs.length} ${j.slug}: ${entry.kind}${entry.file ? ` ${entry.w}x${entry.h} ${entry.bg}${entry.light ? " LIGHT" : ""}` : ""}`);
}
await browser.close();
const mf = path.join(WORK, "manifest.json");
let all = manifest;
if (only && fs.existsSync(mf)) {
  const prev = JSON.parse(fs.readFileSync(mf, "utf8"));
  const by = new Map(manifest.map((e) => [e.slug, e]));
  all = prev.map((e) => by.get(e.slug) ?? e);
}
for (const e of all) if (e.kind === "monogram" && fs.existsSync(path.join(OUTDIR, `${e.slug}.png`))) fs.unlinkSync(path.join(OUTDIR, `${e.slug}.png`));
fs.writeFileSync(mf, JSON.stringify(all, null, 1));
console.log("wrote", mf);
