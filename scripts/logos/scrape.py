#!/usr/bin/env python3
"""Step 1 of the logo pipeline: Firecrawl 'branding' scrape of every company website.

    python3 scripts/logos/scrape.py <final_rows.json> <workdir>

Writes <workdir>/raw/<slug>.json (branding + metadata) and <workdir>/candidates.json:
[{slug, name, website, candidates:[url,...], primary}] in priority order (header logo, apple-touch
icon, og:image, favicon). Re-running skips slugs already scraped.
"""
import json, re, subprocess, sys, concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from add_brands import slugify  # noqa: E402


def brand_slugs():
    brands = json.loads((ROOT / "src" / "brands.json").read_text())
    return {b["name"].strip().lower(): b["slug"] for b in brands}


def scrape(url, out: Path):
    if out.exists() and out.stat().st_size > 50:
        return True
    tmp = out.with_suffix(".tmp")
    try:
        subprocess.run(["firecrawl", "scrape", url, "-f", "branding,rawHtml", "--json", "-o", str(tmp)],
                       capture_output=True, timeout=120)
    except subprocess.TimeoutExpired:
        return False
    if not tmp.exists():
        return False
    try:
        d = json.loads(tmp.read_text())
    except Exception:
        tmp.unlink(missing_ok=True); return False
    html = d.pop("rawHtml", "") or ""
    # keep only <head> link/meta icons + a few header <img> tags: enough for fallbacks
    icons = re.findall(r"<link[^>]+rel=[\"'][^\"']*(?:apple-touch-icon|icon)[^\"']*[\"'][^>]*>", html, re.I)
    imgs = [m for m in re.findall(r"<img[^>]+>", html[:400000], re.I) if re.search(r"logo", m, re.I)][:8]
    d["iconTags"] = icons
    d["logoImgs"] = imgs
    out.write_text(json.dumps(d))
    tmp.unlink(missing_ok=True)
    return True


def main(rows_path, work):
    work = Path(work); (work / "raw").mkdir(parents=True, exist_ok=True)
    rows = json.loads(Path(rows_path).read_text())
    names = brand_slugs()
    jobs = []
    for r in rows:
        name = r["company"].strip()
        slug = names.get(name.lower()) or slugify(name)
        site = (r.get("website") or "").strip()
        jobs.append((slug, name, site))
    with cf.ThreadPoolExecutor(12) as ex:
        futs = {ex.submit(scrape, s, work / "raw" / f"{slug}.json"): slug for slug, _, s in jobs if s}
        done = 0
        for f in cf.as_completed(futs):
            done += 1
            if done % 25 == 0:
                print(f"{done}/{len(futs)}", flush=True)
    print("scrape done", flush=True)
    json.dump([{"slug": s, "name": n, "website": w} for s, n, w in jobs], open(work / "jobs.json", "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
