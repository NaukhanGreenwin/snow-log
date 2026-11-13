// Builds the sample report: fictional Calgary property, December morning visit, 4 photos.
// node test/sample.mjs <baseUrl> <out.pdf> <screensDir>
import { chromium, devices } from "playwright";
import path from "node:path";
const [BASE, OUTPDF, SHOTS] = process.argv.slice(2);
const FIX = path.resolve("test/fixtures");
const T = (hhmm) => new Date(`2026-12-14T${hhmm}:00-06:00`); // Alberta site time (UTC-6 under current tz rules)
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices["Pixel 7"], geolocation: { latitude: 51.0005, longitude: -114.1003, accuracy: 6 }, permissions: ["geolocation"], timezoneId: "America/Edmonton", locale: "en-CA", acceptDownloads: true });
const page = await ctx.newPage();
await page.clock.install({ time: T("07:02") });
await page.goto(BASE, { waitUntil: "networkidle" });
const btn = (re) => page.getByRole("button", typeof re === "string" ? { name: re, exact: true } : { name: re });
await btn(/Start a site visit/).click();
await page.locator("#crew").fill("Dana Mercer, Jordan Alvarez");
await page.waitForTimeout(1500);
await btn(/^Next/).click();
for (const a of ["Walkways and sidewalks", "Entrances and landings", "Stairs", "Parking lot", "Drive aisles", "Fire exits", "Garbage area", "Mailboxes"]) await btn(a).click();
await btn(/Remove Ramps/).click();
await btn("Shovel").click(); await btn("Plow").click(); await btn("Snow blower").click();
await btn(/^Next/).click();
await btn("Treated salt").first().click();
await page.locator("input[inputmode=decimal]").nth(0).fill("60");
for (const a of ["Walkways and sidewalks", "Entrances and landings", "Stairs", "Fire exits"]) await page.locator("fieldset").nth(0).getByRole("button", { name: a }).click();
await btn(/Add another product/).click();
await page.locator("fieldset").nth(1).getByRole("button", { name: "Sand", exact: true }).click();
await page.locator("fieldset").nth(1).locator("input[inputmode=decimal]").fill("3");
await page.locator("fieldset").nth(1).locator("select").selectOption("pails");
for (const a of ["Parking lot", "Drive aisles"]) await page.locator("fieldset").nth(1).getByRole("button", { name: a }).click();
await btn(/^Next/).click();
await page.waitForTimeout(2500);
await page.locator("#temp").fill("-14");
await page.locator("#snow").fill("6");
await btn("Light snow").click();
await page.locator("#wind").fill("12");
await btn(/^Next/).click();
const photos = [["07:21", "after-walkway"], ["07:26", "after-stairs"], ["07:48", "after-parking"], ["07:55", "after-fire-exit"]];
for (const [t, f] of photos) {
  await page.clock.setSystemTime(T(t));
  await page.locator('[data-photo-input="after"]').setInputFiles(path.join(FIX, `${f}.jpg`));
  await page.waitForFunction((n) => document.querySelectorAll(".pcell img").length >= n, photos.findIndex((p) => p[0] === t) + 1, { timeout: 30000 });
}
await page.locator("#hazards").fill("Ice ridge forming under the downspout at the east fire exit. Salted twice; a downspout extension would stop it refreezing.");
await page.locator("#notes").fill("Lot and drive aisles plowed first, windrows pushed to the north fence line and kept clear of the hydrant. Walkways and stairs hand-shovelled and salted.");
await page.screenshot({ path: path.join(SHOTS, "sample-photos-step.png") });
await page.clock.setSystemTime(T("08:04"));
await btn(/^Next/).click();
await btn("Now").click();
await page.locator("#signName").fill("Dana Mercer");
await page.locator("#signRole").fill("Site supervisor");
await page.locator(".sig-frame").scrollIntoViewIfNeeded();
await page.evaluate(() => window.scrollBy(0, 160));
const c = await page.locator(".sig-canvas").boundingBox();
// smooth handwritten-looking stroke: a run of loops with drift, then an underline
const sig = [];
// a tall opening stroke, then cursive-style loops that shrink to the right
for (let k = 0; k <= 30; k++) { const t = k / 30; sig.push([28 + 6 * Math.sin(t * Math.PI), 120 - 70 * Math.sin(t * Math.PI / 2)]); }
for (let k = 0; k <= 30; k++) { const t = k / 30; sig.push([34 + 34 * Math.sin(t * Math.PI), 50 + 70 * t]); }
for (let k = 0; k <= 240; k++) { const t = k / 240, w = 2 * Math.PI * 7 * t; sig.push([60 + t * 180 - 9 * Math.sin(w), 112 - (30 - 16 * t) * (1 - Math.cos(w)) / 2]); }
await page.mouse.move(c.x + sig[0][0], c.y + sig[0][1]); await page.mouse.down();
for (const [x, y] of sig.slice(1)) await page.mouse.move(c.x + x, c.y + y);
await page.mouse.up();
await page.mouse.move(c.x + 60, c.y + 136); await page.mouse.down(); await page.mouse.move(c.x + 250, c.y + 130, { steps: 12 }); await page.mouse.up();
await page.screenshot({ path: path.join(SHOTS, "sample-sign-step.png") });
await btn(/Finish and make report/).click();
await page.getByText("Visit logged").waitFor({ timeout: 60000 });
await page.screenshot({ path: path.join(SHOTS, "sample-done.png") });
const [dl] = await Promise.all([page.waitForEvent("download"), btn(/Download PDF/).click()]);
await dl.saveAs(OUTPDF);
console.log("saved", OUTPDF, dl.suggestedFilename());
await b.close();
