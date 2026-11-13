// Full-visit device test: iPhone 13 (WebKit) + Pixel 7 (Chromium), in parallel.
// node test/flow.mjs [baseUrl] [outDir]
// Logs a visit (site, crew, 6 areas + custom, method, salt, weather from Open-Meteo, 2 before + 2 after
// photos, signature), makes the PDF, then goes offline, reloads and re-downloads the PDF from History.
import { chromium, webkit, devices } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "https://naukhangreenwin.github.io/snow-log/";
const OUT = process.argv[3] ?? path.resolve("test-results");
const FIX = path.resolve("test/fixtures");
fs.mkdirSync(OUT, { recursive: true });

async function run(name, engine, device) {
  let pageRef = null;
  try { return await runInner(name, engine, device, (p) => (pageRef = p)); }
  catch (e) { if (pageRef) await pageRef.screenshot({ path: path.join(OUT, `${name}-FAIL.png`) }).catch(() => {}); throw e; }
}
async function runInner(name, engine, device, keep) {
  const log = (...a) => console.log(`[${name}]`, ...a);
  const browser = await engine.launch();
  const ctx = await browser.newContext({
    ...devices[device],
    geolocation: { latitude: 51.0005, longitude: -114.1003, accuracy: 8 },
    permissions: engine === chromium ? ["geolocation"] : [],
    timezoneId: "America/Edmonton",
    locale: "en-CA",
    acceptDownloads: true,
  });
  if (engine !== chromium) await ctx.grantPermissions(["geolocation"]).catch(() => {});
  const page = await ctx.newPage();
  keep(page);
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text()}`); });
  const shot = (n) => page.screenshot({ path: path.join(OUT, `${name}-${n}.png`) });
  const btn = (re) => page.getByRole("button", typeof re === "string" ? { name: re, exact: true } : { name: re });

  await page.goto(`${BASE}?c=itrs-test`, { waitUntil: "networkidle" });
  await page.evaluate(() => navigator.serviceWorker?.ready);
  await page.getByText("Prepared for Northgate Test Properties").waitFor();
  await shot("01-home");

  await btn(/Start a site visit/).click();
  await page.locator("#crew").fill("Sam Ortiz, Priya Nair");
  await page.waitForFunction(() => document.querySelector(".gps-t")?.textContent?.includes("51.0"), null, { timeout: 15000 }).catch(() => log("gps not auto-stamped"));
  await shot("02-site");
  await btn(/^Next/).click();

  for (const a of ["Walkways and sidewalks", "Entrances and landings", "Stairs", "Parking lot", "Fire exits", "Mailboxes"]) await btn(a).click();
  await page.locator("#newarea").fill("Loading dock");
  await btn(/^Add$/).click();
  await btn("Shovel").click(); await btn("Plow").click();
  await shot("03-areas");
  await btn(/^Next/).click();

  await btn("Ice melt (calcium chloride)").click();
  await page.locator("input[inputmode=decimal]").first().fill("40");
  await btn("Walkways and sidewalks").click(); await btn("Stairs").click();
  await shot("04-salt");
  await btn(/^Next/).click();

  const wxOk = await page.waitForFunction(() => (document.querySelector("#temp")?.value ?? "") !== "", null, { timeout: 20000 }).then(() => true).catch(() => false);
  log("weather auto-filled from Open-Meteo:", wxOk, await page.locator("#temp").inputValue(), await page.locator("#snow").inputValue());
  if (!wxOk) { await page.locator("#temp").fill("-14"); await btn("Light snow").click(); }
  await shot("05-weather");
  await btn(/^Next/).click();

  await page.locator('[data-photo-input="before"]').setInputFiles([path.join(FIX, "after-parking.jpg"), path.join(FIX, "after-fire-exit.jpg")]);
  await page.waitForFunction(() => document.querySelectorAll(".pcell img").length >= 2, null, { timeout: 30000 });
  await page.locator('[data-photo-input="after"]').setInputFiles([path.join(FIX, "after-walkway.jpg"), path.join(FIX, "after-stairs.jpg")]);
  await page.waitForFunction(() => document.querySelectorAll(".pcell img").length >= 4, null, { timeout: 30000 });
  await page.locator("#hazards").fill("Downspout at the east entrance drains onto the walkway; salted extra.");
  await shot("06-photos");
  await btn(/^Next/).click();

  // reload mid-visit: everything must come back
  await page.reload({ waitUntil: "networkidle" });
  await btn(/Continue visit/).click();
  for (let i = 0; i < 5; i++) await btn(/^Next/).click();
  await page.locator("#signName").fill("Sam Ortiz");
  await page.locator("#signRole").fill("Site supervisor");
  await page.locator(".sig-frame").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 160));
  const c = await page.locator(".sig-canvas").boundingBox();
  await page.mouse.move(c.x + 30, c.y + 110); await page.mouse.down();
  for (let i = 1; i <= 24; i++) await page.mouse.move(c.x + 30 + i * 10, c.y + 110 - Math.sin(i / 2.5) * 34);
  await page.mouse.up();
  await shot("07-sign");
  await btn(/Finish and make report/).click();
  await page.getByText("Visit logged").waitFor({ timeout: 60000 });
  await shot("08-done");

  const [dl] = await Promise.all([page.waitForEvent("download"), btn(/Download PDF/).click()]);
  const pdfPath = path.join(OUT, `${name}-report.pdf`);
  await dl.saveAs(pdfPath);
  const buf = fs.readFileSync(pdfPath);
  log("pdf", dl.suggestedFilename(), buf.length, "bytes, magic", buf.subarray(0, 5).toString());

  // offline reload: shell from the service worker, history still there, PDF rebuilt offline
  await ctx.setOffline(true);
  await page.reload({ waitUntil: "load" });
  await btn(/Past reports on this phone \(1\)/).waitFor({ timeout: 15000 });
  await shot("09-offline-home");
  await btn(/Past reports on this phone/).click();
  const [dl2] = await Promise.all([page.waitForEvent("download"), btn(/^PDF$/).click()]);
  const p2 = path.join(OUT, `${name}-report-offline.pdf`);
  await dl2.saveAs(p2);
  const b2 = fs.readFileSync(p2);
  log("offline re-download", b2.length, "bytes, magic", b2.subarray(0, 5).toString());
  await shot("10-offline-history");

  const real = errors.filter((e) => !/Failed to load resource|net::ERR_INTERNET_DISCONNECTED|offline/i.test(e));
  log("errors:", real.length ? real : "none");
  await browser.close();
  const pass = buf.subarray(0, 4).toString() === "%PDF" && b2.subarray(0, 4).toString() === "%PDF" && real.length === 0;
  log(pass ? "PASS" : "FAIL");
  return pass;
}

const only = process.argv[4];
const runs = [["iphone13-webkit", webkit, "iPhone 13"], ["pixel7-chromium", chromium, "Pixel 7"]].filter((r) => !only || r[0].startsWith(only));
const res = await Promise.allSettled(runs.map((r) => run(...r)));
res.forEach((r) => { if (r.status === "rejected") console.log("RUN ERROR", r.reason?.message ?? r.reason); });
process.exit(res.every((r) => r.status === "fulfilled" && r.value) ? 0 : 1);
