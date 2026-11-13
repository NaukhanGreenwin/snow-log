// Home-screen screenshots per brand on iPhone 13 / Pixel 7. node test/screens.mjs <baseUrl> <outDir> <slug>...
import { chromium, webkit, devices } from "playwright";
import path from "node:path";
import fs from "node:fs";
const [BASE, OUT, ...slugs] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
for (const [name, engine, dev] of [["iphone13", webkit, "iPhone 13"], ["pixel7", chromium, "Pixel 7"]]) {
  const b = await engine.launch();
  for (const s of slugs) {
    const ctx = await b.newContext({ ...devices[dev], timezoneId: "America/Edmonton", locale: "en-CA" });
    const p = await ctx.newPage();
    await p.goto(`${BASE}?c=${s}`, { waitUntil: "networkidle" });
    await p.waitForTimeout(700);
    const logo = await p.evaluate(() => [...document.querySelectorAll(".mark-img")].map((i) => i.complete && i.naturalWidth > 0));
    console.log(name, s, "logo loaded:", JSON.stringify(logo));
    await p.screenshot({ path: path.join(OUT, `${name}-${s}.png`) });
    await ctx.close();
  }
  await b.close();
}
