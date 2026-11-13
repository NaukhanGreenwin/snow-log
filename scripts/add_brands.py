#!/usr/bin/env python3
"""Add companies to Snow Log and print each company's branded link.

    python3 scripts/add_brands.py <rows.json> [--deploy] [--tsv out.tsv]

rows.json: a JSON array of objects. Uses "company" (required) and "city"; optional "slug", "logo"
(https URL), "accent" (#rrggbb), "sample_property", "sample_address". Research rows from
projects/alberta-snowlog/research/*.json work as-is (extra keys are ignored).
Existing brands are matched by slug or company name and updated, never duplicated.
Writes src/brands.json. --deploy runs ./deploy.sh afterwards so the links go live.
"""
import json, re, subprocess, sys, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDS = ROOT / "src" / "brands.json"
URL = "https://itrapidsupport.github.io/snow-log/?c={}"
DEFAULT_ACCENT = "#1f3a5f"
STOP = {"inc", "ltd", "limited", "corp", "corporation", "co", "llc", "the"}


def slugify(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    s = s.replace("&", " and ")
    words = [w for w in re.split(r"[^a-z0-9]+", s) if w and w not in STOP]
    return "-".join(words)[:48].strip("-") or "company"


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__); return 0
    src = Path(argv[0])
    deploy = "--deploy" in argv
    tsv = argv[argv.index("--tsv") + 1] if "--tsv" in argv else None
    rows = json.loads(src.read_text())
    if not isinstance(rows, list):
        sys.exit("rows.json must be a JSON array")
    brands = json.loads(BRANDS.read_text()) if BRANDS.exists() else []
    by_slug = {b["slug"]: b for b in brands}
    by_name = {b["name"].strip().lower(): b for b in brands}
    out = []
    for r in rows:
        name = (r.get("company") or r.get("name") or "").strip()
        if not name:
            continue
        b = by_name.get(name.lower())
        if b is None:
            slug = (r.get("slug") or slugify(name)).strip().lower()
            base, n = slug, 2
            while slug in by_slug or slug == "demo":
                slug = f"{base}-{n}"; n += 1
            b = {"slug": slug, "name": name}
            brands.append(b); by_slug[slug] = b; by_name[name.lower()] = b
        city = (r.get("city") or b.get("city") or "").strip()
        accent = (r.get("accent") or b.get("accent") or DEFAULT_ACCENT).strip()
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", accent):
            accent = DEFAULT_ACCENT
        b.update({
            "accent": accent,
            "city": city,
            "sampleProperty": (r.get("sample_property") or b.get("sampleProperty") or "Sample property").strip(),
            "sampleAddress": (r.get("sample_address") or b.get("sampleAddress") or (f"{city}, AB" if city else "")).strip(),
        })
        logo = (r.get("logo") or b.get("logo") or "").strip()
        if logo.startswith("https://"):
            b["logo"] = logo
        else:
            b.pop("logo", None)
        out.append((name, URL.format(b["slug"])))
    brands.sort(key=lambda x: x["slug"])
    BRANDS.write_text(json.dumps(brands, indent=2, ensure_ascii=False) + "\n")
    for name, url in out:
        print(f"{name}\t{url}")
    if tsv:
        Path(tsv).write_text("company\turl\n" + "".join(f"{n}\t{u}\n" for n, u in out))
    print(f"# {len(out)} companies, {len(brands)} brands in src/brands.json", file=sys.stderr)
    if deploy:
        subprocess.run([str(ROOT / "deploy.sh")], check=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
