// Contact sheet for eyeballing logo quality: node scripts/logos/sheet.mjs <manifest.json> <outdir>
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
const [mf, out] = process.argv.slice(2);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const list = JSON.parse(fs.readFileSync(mf, "utf8"));
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 } });
const per = 48;
for (let s = 0; s * per < list.length; s++) {
  const items = list.slice(s * per, s * per + per).map((e, i) => {
    const n = s * per + i + 1;
    const img = e.file ? `<img src="file://${ROOT}/public/logos/${e.file}">` : `<div class="mono">MONO</div>`;
    return `<div class="c ${e.light ? "light" : ""}"><div class="box">${img}</div><div class="t">${n}. ${e.slug.slice(0, 30)}<br>${e.kind} ${e.w ?? ""}x${e.h ?? ""} ${e.bg ?? ""}</div></div>`;
  }).join("");
  fs.writeFileSync(path.join(out, 'sheet.html'), `<style>body{margin:8px;font:11px sans-serif;display:grid;grid-template-columns:repeat(8,1fr);gap:6px}.c{border:1px solid #ddd;padding:4px}.box{height:70px;display:grid;place-items:center;background:#fff}.light .box{background:#1f3a5f}img{max-height:60px;max-width:150px}.mono{color:#c00}.c{font-size:10px}.t{color:#333;margin-top:3px}</style>${items}`);
  await p.goto('file://' + path.join(out, 'sheet.html'));
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(out, `sheet-${s + 1}.png`), fullPage: true });
}
await b.close();
