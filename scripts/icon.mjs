import { chromium } from "playwright";
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 512, height: 512 } });
await p.goto("file://" + process.cwd() + "/public/brand/icon.svg"); await p.screenshot({ path: "public/brand/icon.png" }); await b.close();
