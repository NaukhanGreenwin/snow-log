#!/usr/bin/env python3
"""Step 3 of the logo pipeline: copy logo results into src/brands.json and write the coverage manifest.

    python3 scripts/logos/apply.py <workdir>

For each brand in the manifest: logo = "logos/<slug>.png" + logoW/logoH/logoLight, or no logo
(monogram). Accent = the company's primary colour from its website (Firecrawl branding), darkened
until white text reads on it; unchanged if there is none. Writes public/logos/manifest.json.
"""
import colorsys, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BRANDS = ROOT / "src" / "brands.json"
DEFAULT = "#1f3a5f"


def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4 for v in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def accent_from(primary):
    if not primary or not re.fullmatch(r"#[0-9a-fA-F]{6}", primary.strip()):
        return None
    h = primary.strip().lower()
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    if ss < 0.12 and ll > 0.25:      # grey / near-white page colour: not a brand colour
        return None
    if ll < 0.06:                    # pure black: use a soft ink instead
        return "#151b26"
    # Wix/Squarespace default link blues are site-builder colours, not the brand
    if h in ("#116dff", "#0000ee", "#3899ec"):
        return None
    k = 0
    while lum(h) > 0.2 and k < 20:   # white button text needs ~4.5:1
        ll *= 0.9
        r, g, b = colorsys.hls_to_rgb(hh, ll, ss)
        h = "#%02x%02x%02x" % tuple(round(v * 255) for v in (r, g, b))
        k += 1
    return h


def main(work):
    work = Path(work)
    man = json.loads((work / "manifest.json").read_text())
    brands = json.loads(BRANDS.read_text())
    by = {b["slug"]: b for b in brands}
    out = []
    real = mono = 0
    for e in man:
        b = by.get(e["slug"])
        if not b:
            print("no brand for", e["slug"], file=sys.stderr); continue
        for k in ("logo", "logoW", "logoH", "logoLight"):
            b.pop(k, None)
        if e.get("file") and (ROOT / "public" / "logos" / e["file"]).exists():
            b["logo"] = f"logos/{e['file']}"
            b["logoW"], b["logoH"] = e["w"], e["h"]
            if e.get("light"):
                b["logoLight"] = True
            real += 1
        else:
            mono += 1
        acc = accent_from(e.get("primary"))
        if acc:
            b["accent"] = acc
        out.append({"slug": e["slug"], "company": e["name"], "website": e.get("website"),
                    "mark": "logo" if "logo" in b else "monogram", "file": b.get("logo"),
                    "size": [e.get("w"), e.get("h")] if "logo" in b else None, "onAccentTile": bool(b.get("logoLight")),
                    "source": e.get("source") if "logo" in b else None, "foundAs": e.get("kind") if "logo" in b else None,
                    "accent": b.get("accent"), "notes": e.get("tried") or []})
    BRANDS.write_text(json.dumps(brands, indent=2, ensure_ascii=False) + "\n")
    (ROOT / "public" / "logos" / "manifest.json").write_text(json.dumps(
        {"total": len(out), "realLogo": real, "monogram": mono, "brands": out}, indent=1, ensure_ascii=False) + "\n")
    print(f"real logos {real} / monogram {mono} / total {len(out)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/sl-logos")
