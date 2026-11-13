// Quick check: each URL loads on the live host and shows its company name. Usage: node test/brandcheck.mjs <url> <expected name> ...
import { chromium } from "playwright";
const args = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
let fail = 0;
for (let i = 0; i < args.length; i += 2) {
  const [url, name] = [args[i], args[i + 1]];
  const r = await p.goto(url, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const txt = await p.innerText("body");
  const ok = r.status() === 200 && txt.includes(name);
  if (!ok) fail++;
  console.log(ok ? "OK  " : "FAIL", r.status(), name, "|", url, "|", (await p.title()));
}
await b.close();
process.exit(fail ? 1 : 0);
