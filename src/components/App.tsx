"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { PhotoKind, Visit } from "@/lib/types";
import { type Brand, MAKER, accentOf, currentBrand, brandBySlug } from "@/lib/brand";
import { METHODS, PRODUCTS, UNITS, newSalt, newVisit, pdfFileName, saltFilled } from "@/lib/template";
import { fmtClock, fmtDay, fmtStamp, fmtStampTime, siteTime, uid, zoneAbbr } from "@/lib/time";
import { CONDITIONS, fetchWeather, getGps } from "@/lib/weather";
import {
  deletePhoto, deleteVisit, getVisit, listVisits, loadDraft, photoUrl, prunePhotos, putPhoto, putVisit,
  requestPersistence, saveDraft, storageWorks,
} from "@/lib/store";
import { PhotoError, isHeic, processPhoto } from "@/lib/photos";
import SignaturePad from "./SignaturePad";
import { IconBack, IconCamera, IconCheck, IconClose, IconDownload, IconFile, IconNext, IconPin, IconPlus, IconRefresh, IconShare } from "./icons";

const STEPS = ["Site and time", "Areas cleared", "Salt and ice melt", "Weather", "Photos and notes", "Sign off"];
type Screen = "home" | "step" | "done" | "history";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/* ---------------------------------------------------------------- small pieces */

function Thumb({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let on = true; photoUrl(id).then((u) => on && setSrc(u)); return () => { on = false; }; }, [id]);
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} /> : <span className="ph-missing" aria-label={alt} />;
}

function Field({ label, hint, children, id }: { label: string; hint?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      {children}
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" className={`chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={onClick}>{children}</button>;
}

function BrandMark({ brand }: { brand: Brand }) {
  const [bad, setBad] = useState(false);
  if (brand.logo && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="brand-logo" src={brand.logo} alt={brand.name} onError={() => setBad(true)} />;
  }
  return <span className="brand-name">{brand.name}</span>;
}

/* ---------------------------------------------------------------- app */

export default function App() {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Visit | null>(null);
  const [draft, setDraft] = useState<Visit | null>(null);
  const [history, setHistory] = useState<Visit[]>([]);
  const [msg, setMsg] = useState<{ title: string; body: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pdf, setPdf] = useState<{ blob: Blob; name: string; visit: Visit } | null>(null);
  const [viewer, setViewer] = useState<string | null>(null);
  const [noStore, setNoStore] = useState(false);
  const [online, setOnline] = useState(true);
  const top = useRef<HTMLDivElement>(null);

  /* boot */
  useEffect(() => {
    const b = currentBrand();
    setBrand(b);
    const d = loadDraft();
    setDraft(d);
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    void (async () => {
      setNoStore(!(await storageWorks()));
      const h = await listVisits().catch(() => [] as Visit[]);
      setHistory(h);
      const keep = new Set(h.map((x) => x.id)); if (d) keep.add(d.id);
      prunePhotos(keep).catch(() => {});
      requestPersistence();
      import("@/lib/pdf").catch(() => {}); // warm the PDF code so it is cached for offline use
    })();
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${BASE}/sw.js`, { scope: `${BASE}/` }).catch(() => {});
    }
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const accent = brand ? accentOf(brand) : "#1f3a5f";
  const style = { "--accent": accent } as CSSProperties;

  /* every change autosaves the draft */
  const update = useCallback((fn: (d: Visit) => Visit) => {
    setV((cur) => {
      if (!cur) return cur;
      const next = { ...fn(cur), updatedAt: new Date().toISOString() };
      saveDraft(next);
      return next;
    });
  }, []);

  const scrollTop = () => requestAnimationFrame(() => { window.scrollTo({ top: 0 }); top.current?.focus({ preventScroll: true }); });
  const go = (n: number) => { setErrors([]); setStep(n); setScreen("step"); scrollTop(); };

  const start = (fresh: boolean) => {
    if (!brand) return;
    if (!fresh && draft) { setV(draft); go(0); return; }
    if (draft) prunePhotos(new Set(history.map((h) => h.id))).catch(() => {});
    const n = newVisit(brand, history.length === 0 && !draft);
    saveDraft(n); setDraft(n); setV(n); go(0);
    // stamp the location straight away; the phone asks once
    getGps().then((g) => update((d) => (d.gps ? d : { ...d, gps: g }))).catch(() => {});
  };

  /* ------------------------------------------------ photos */
  const addPhotos = async (files: File[], kind: PhotoKind) => {
    if (!v) return;
    const failed: string[] = [];
    for (const f of files) {
      try {
        const rec = await processPhoto(f, v.id, kind);
        await putPhoto(rec);
        update((d) => ({ ...d, photos: [...d.photos, { id: rec.id, kind, takenAt: rec.takenAt }] }));
      } catch (e) {
        failed.push(e instanceof PhotoError && e.kind === "heic" || isHeic(f) ? `${f.name}: HEIC photos cannot be opened in this browser. Take the photo with the camera button instead.` : `${f.name || "Photo"}: could not be saved on this phone.`);
      }
    }
    if (failed.length) setMsg({ title: `${failed.length} photo${failed.length > 1 ? "s" : ""} not added`, body: failed.join("\n") });
  };
  const removePhoto = (id: string) => { update((d) => ({ ...d, photos: d.photos.filter((p) => p.id !== id) })); deletePhoto(id).catch(() => {}); setViewer(null); };

  /* ------------------------------------------------ GPS + weather */
  const recordGps = async () => {
    setBusy("gps");
    try { const g = await getGps(); update((d) => ({ ...d, gps: g })); }
    catch (e) { setMsg({ title: "Location not recorded", body: (e as Error).message }); }
    finally { setBusy(""); }
  };
  const fillWeather = useCallback(async (quiet = false) => {
    if (!v) return;
    setBusy("wx");
    try {
      const g = v.gps ?? (await getGps());
      if (!v.gps) update((d) => ({ ...d, gps: g }));
      const w = await fetchWeather(g);
      update((d) => ({ ...d, weather: w }));
    } catch (e) { if (!quiet) setMsg({ title: "Weather not filled", body: (e as Error).message }); }
    finally { setBusy(""); }
  }, [v, update]);

  // first time on the weather step, online, nothing typed yet: fill it in
  const autoWx = useRef("");
  useEffect(() => {
    if (screen === "step" && step === 3 && v && online && !v.weather.source && !v.weather.tempC && autoWx.current !== v.id) {
      autoWx.current = v.id;
      void fillWeather(true);
    }
  }, [screen, step, v, online, fillWeather]);

  /* ------------------------------------------------ checks */
  const check = (n: number, d: Visit): string[] => {
    const e: string[] = [];
    if (n === 0) {
      if (!d.property.trim()) e.push("Enter the property name.");
      if (!d.date) e.push("Enter the visit date.");
      if (!d.start) e.push("Enter the start time.");
      if (!d.crew.trim()) e.push("Enter who did the work.");
    }
    if (n === 1 && !d.areas.some((a) => a.done)) e.push("Tick at least one area that was cleared.");
    if (n === 5) {
      if (!d.end) e.push("Enter the finish time.");
      if (!d.signName.trim()) e.push("Enter the name of the person signing.");
      if (!d.signature) e.push("Sign in the box.");
    }
    return e;
  };
  const next = () => {
    if (!v) return;
    const e = check(step, v);
    if (e.length) { setErrors(e); requestAnimationFrame(() => document.getElementById("errors")?.focus()); return; }
    if (step === 4 && !v.end) update((d) => ({ ...d, end: siteTime() }));
    go(step + 1);
  };

  /* ------------------------------------------------ finish */
  const makePdf = async (visit: Visit) => {
    const b = brandBySlug(visit.brand) ?? brand!;
    const { buildPdf } = await import("@/lib/pdf");
    return { blob: await buildPdf(visit, b), name: pdfFileName(visit), visit };
  };
  const finish = async () => {
    if (!v) return;
    for (let n = 0; n < STEPS.length; n++) {
      const e = check(n, v);
      if (e.length) { setStep(n); setErrors(e); setScreen("step"); scrollTop(); return; }
    }
    setBusy("pdf");
    try {
      const done: Visit = { ...v, completedAt: new Date().toISOString() };
      const out = await makePdf(done);
      await putVisit(done);
      saveDraft(null); setDraft(null); setV(null);
      setHistory(await listVisits());
      setPdf(out);
      setScreen("done"); scrollTop();
    } catch (e) {
      setMsg({ title: "The report could not be made", body: `Nothing was lost; the visit is still on this phone. Try again. (${(e as Error).message})` });
    } finally { setBusy(""); }
  };

  const share = async (o: { blob: Blob; name: string; visit: Visit }) => {
    const file = new File([o.blob], o.name, { type: "application/pdf" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({ files: [file], title: o.name.replace(/\.pdf$/, ""), text: `Snow log for ${o.visit.property}, ${fmtDay(o.visit.date, false)}. Report ${o.visit.id}.` });
        return;
      } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    download(o);
  };
  const download = (o: { blob: Blob; name: string }) => {
    const u = URL.createObjectURL(o.blob);
    const a = document.createElement("a");
    a.href = u; a.download = o.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30_000);
  };
  const reopen = async (id: string, how: "share" | "download") => {
    setBusy(`h-${id}`);
    try {
      const visit = await getVisit(id);
      if (!visit) throw new Error("not found");
      const o = await makePdf(visit);
      if (how === "share") await share(o); else download(o);
    } catch (e) { setMsg({ title: "Report not available", body: (e as Error).message }); }
    finally { setBusy(""); }
  };
  const removeVisit = async (id: string) => {
    if (!confirm("Delete this report and its photos from this phone?")) return;
    await deleteVisit(id).catch(() => {});
    setHistory(await listVisits());
  };

  const discard = () => {
    if (!confirm("Discard this visit? Its details and photos will be deleted from this phone.")) return;
    saveDraft(null); setDraft(null); setV(null);
    prunePhotos(new Set(history.map((h) => h.id))).catch(() => {});
    setScreen("home"); scrollTop();
  };

  if (!brand) return <div className="boot" />;

  const zone = zoneAbbr(v?.date ?? "");
  const before = v?.photos.filter((p) => p.kind === "before") ?? [];
  const after = v?.photos.filter((p) => p.kind === "after") ?? [];

  /* ------------------------------------------------ render */
  return (
    <div className="shell" style={style}>
      <header className="bar">
        <div className="bar-inner">
          <button type="button" className="bar-brand" onClick={() => { setScreen("home"); scrollTop(); }} aria-label="Home">
            <BrandMark brand={brand} />
          </button>
          <span className="bar-app">Snow Log</span>
        </div>
        {screen === "step" && (
          <div className="progress" aria-hidden="true"><span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
        )}
      </header>

      {!online && <p className="offline">Offline. Everything is saved on this phone; weather can be typed in.</p>}
      {noStore && <p className="warn">This browser cannot keep photos (private browsing). Open the link in a normal tab before starting.</p>}

      <main className="main" ref={top} tabIndex={-1}>
        {/* ---------------- home ---------------- */}
        {screen === "home" && (
          <div className="home">
            <p className="eyebrow">Prepared for {brand.name}</p>
            <h1 className="h1">Snow clearing and salting log</h1>
            <p className="lede">Record each site visit as it happens: areas cleared, salt used, weather, photos and a signature. The phone makes a dated PDF report for the office.</p>

            {draft ? (
              <div className="card">
                <p className="card-k">Visit in progress</p>
                <p className="card-t">{draft.property || "Untitled site"}</p>
                <p className="card-s">{fmtDay(draft.date, false)}, started {fmtClock(draft.start)} {zoneAbbr(draft.date)} · {draft.photos.length} photo{draft.photos.length === 1 ? "" : "s"}</p>
                <div className="row">
                  <button type="button" className="btn btn-primary" onClick={() => start(false)}>Continue visit <IconNext /></button>
                  <button type="button" className="btn btn-quiet" onClick={discard}>Discard</button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn btn-primary btn-xl" onClick={() => start(true)}><IconPlus /> Start a site visit</button>
            )}

            <ol className="how">
              <li><span>1</span>Site, crew and start time</li>
              <li><span>2</span>Tick the areas cleared</li>
              <li><span>3</span>Log salt, ice melt or sand</li>
              <li><span>4</span>Weather, filled from your location</li>
              <li><span>5</span>Before and after photos</li>
              <li><span>6</span>Sign off and send the PDF</li>
            </ol>

            {history.length > 0 && (
              <button type="button" className="btn btn-quiet btn-block" onClick={() => { setScreen("history"); scrollTop(); }}>
                <IconFile /> Past reports on this phone ({history.length})
              </button>
            )}
            <p className="fine">Works without signal. Reports stay on this phone until you send them. Snow Log by {MAKER}.</p>
          </div>
        )}

        {/* ---------------- steps ---------------- */}
        {screen === "step" && v && (
          <div className="step">
            <p className="eyebrow">Step {step + 1} of {STEPS.length}</p>
            <h1 className="h2">{STEPS[step]}</h1>

            {errors.length > 0 && (
              <div className="errors" id="errors" tabIndex={-1} role="alert">
                {errors.map((e) => <p key={e}>{e}</p>)}
              </div>
            )}

            {step === 0 && (
              <>
                <Field id="property" label="Property">
                  <input id="property" className="input" value={v.property} autoComplete="off" onChange={(e) => update((d) => ({ ...d, property: e.target.value }))} placeholder="Building or site name" />
                </Field>
                <Field id="address" label="Address">
                  <input id="address" className="input" value={v.address} autoComplete="off" onChange={(e) => update((d) => ({ ...d, address: e.target.value }))} placeholder="Street, city" />
                </Field>
                <Field id="date" label="Visit date">
                  <input id="date" type="date" className="input" value={v.date} onChange={(e) => update((d) => ({ ...d, date: e.target.value }))} />
                </Field>
                <div className="two">
                  <Field id="start" label={`Start (${zone})`}>
                    <input id="start" type="time" className="input" value={v.start} onChange={(e) => update((d) => ({ ...d, start: e.target.value }))} />
                  </Field>
                  <Field id="end" label={`Finish (${zone})`}>
                    <div className="with-btn">
                      <input id="end" type="time" className="input" value={v.end} onChange={(e) => update((d) => ({ ...d, end: e.target.value }))} />
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => update((d) => ({ ...d, end: siteTime() }))}>Now</button>
                    </div>
                  </Field>
                </div>
                <Field id="crew" label="Crew" hint="Names of everyone who worked this visit.">
                  <input id="crew" className="input" value={v.crew} autoComplete="off" onChange={(e) => update((d) => ({ ...d, crew: e.target.value }))} placeholder="e.g. Sam Ortiz, Priya Nair" />
                </Field>
                <div className="gps">
                  <IconPin />
                  <div>
                    <p className="gps-t">{v.gps ? `${v.gps.lat.toFixed(5)}, ${v.gps.lon.toFixed(5)}` : "Location not recorded yet"}</p>
                    <p className="hint">{v.gps ? `Within ${v.gps.acc} m, ${fmtStamp(v.gps.at)}` : "Stamps the visit with where the phone is."}</p>
                  </div>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={recordGps} disabled={busy === "gps"}>{busy === "gps" ? "Locating" : v.gps ? "Update" : "Record"}</button>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="hint hint-top">Tap each area that was cleared on this visit.</p>
                <ul className="ticks">
                  {v.areas.map((a) => (
                    <li key={a.key}>
                      <button type="button" className={`tick${a.done ? " is-on" : ""}`} aria-pressed={a.done}
                        onClick={() => update((d) => ({ ...d, areas: d.areas.map((x) => (x.key === a.key ? { ...x, done: !x.done } : x)) }))}>
                        <span className="tick-box">{a.done && <IconCheck size={20} />}</span>
                        <span className="tick-l">{a.label}</span>
                      </button>
                      {(a.custom || !a.done) && (
                        <button type="button" className="tick-x" aria-label={`Remove ${a.label} (not at this site)`} onClick={() => update((d) => ({ ...d, areas: d.areas.filter((x) => x.key !== a.key) }))}><IconClose size={18} /></button>
                      )}
                    </li>
                  ))}
                </ul>
                <AddArea onAdd={(label) => update((d) => ({ ...d, areas: [...d.areas, { key: uid("a"), label, done: true, custom: true }] }))} />
                <div className="row-wrap">
                  <button type="button" className="link" onClick={() => update((d) => ({ ...d, areas: d.areas.map((x) => ({ ...x, done: true })) }))}>Tick all</button>
                  <button type="button" className="link" onClick={() => update((d) => ({ ...d, areas: d.areas.map((x) => ({ ...x, done: false })) }))}>Clear all</button>
                </div>
                <h2 className="h3">Method</h2>
                <div className="chips">
                  {METHODS.map((m) => (
                    <Chip key={m} on={v.methods.includes(m)} onClick={() => update((d) => ({ ...d, methods: d.methods.includes(m) ? d.methods.filter((x) => x !== m) : [...d.methods, m] }))}>{m}</Chip>
                  ))}
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <p className="hint hint-top">One line per product. Leave it empty if nothing was applied.</p>
                {v.salt.map((s, i) => (
                  <fieldset key={s.id} className="salt">
                    <legend className="salt-h">Application {i + 1}
                      {v.salt.length > 1 && <button type="button" className="link" onClick={() => update((d) => ({ ...d, salt: d.salt.filter((x) => x.id !== s.id) }))}>Remove</button>}
                    </legend>
                    <Field id={`p-${s.id}`} label="Product">
                      <input id={`p-${s.id}`} className="input" list="products" value={s.product} onChange={(e) => update((d) => ({ ...d, salt: d.salt.map((x) => (x.id === s.id ? { ...x, product: e.target.value } : x)) }))} placeholder="Choose or type" />
                    </Field>
                    <div className="chips chips-sm">
                      {PRODUCTS.slice(0, 5).map((p) => <Chip key={p} on={s.product === p} onClick={() => update((d) => ({ ...d, salt: d.salt.map((x) => (x.id === s.id ? { ...x, product: p } : x)) }))}>{p}</Chip>)}
                    </div>
                    <div className="two">
                      <Field id={`a-${s.id}`} label="Amount">
                        <input id={`a-${s.id}`} className="input" inputMode="decimal" value={s.amount} onChange={(e) => update((d) => ({ ...d, salt: d.salt.map((x) => (x.id === s.id ? { ...x, amount: e.target.value.replace(/[^0-9.,]/g, "") } : x)) }))} placeholder="0" />
                      </Field>
                      <Field id={`u-${s.id}`} label="Unit">
                        <select id={`u-${s.id}`} className="input" value={s.unit} onChange={(e) => update((d) => ({ ...d, salt: d.salt.map((x) => (x.id === s.id ? { ...x, unit: e.target.value } : x)) }))}>
                          {UNITS.map((u) => <option key={u}>{u}</option>)}
                        </select>
                      </Field>
                    </div>
                    <Field id={`w-${s.id}`} label="Where applied">
                      <input id={`w-${s.id}`} className="input" value={s.areas} onChange={(e) => update((d) => ({ ...d, salt: d.salt.map((x) => (x.id === s.id ? { ...x, areas: e.target.value } : x)) }))} placeholder="e.g. front steps, main walkway" />
                    </Field>
                    <div className="chips chips-sm">
                      {v.areas.filter((a) => a.done).map((a) => {
                        const on = s.areas.split(/,\s*/).includes(a.label.toLowerCase());
                        return <Chip key={a.key} on={on} onClick={() => update((d) => ({ ...d, salt: d.salt.map((x) => {
                          if (x.id !== s.id) return x;
                          const list = x.areas.split(/,\s*/).filter(Boolean);
                          const l = a.label.toLowerCase();
                          return { ...x, areas: (on ? list.filter((y) => y !== l) : [...list, l]).join(", ") };
                        }) }))}>{a.label}</Chip>;
                      })}
                    </div>
                  </fieldset>
                ))}
                <datalist id="products">{PRODUCTS.map((p) => <option key={p} value={p} />)}</datalist>
                <button type="button" className="btn btn-quiet btn-block" onClick={() => update((d) => ({ ...d, salt: [...d.salt, newSalt()] }))}><IconPlus /> Add another product</button>
              </>
            )}

            {step === 3 && (
              <>
                <div className="wx-head">
                  <p className="hint">{v.weather.source === "open-meteo" ? `Filled from Open-Meteo for your location, ${fmtStampTime(v.weather.fetchedAt)}. Correct anything that does not match the site.` : "Fill from the weather service by your location, or type what you see."}</p>
                  <button type="button" className="btn btn-quiet btn-sm" onClick={() => fillWeather(false)} disabled={busy === "wx" || !online}><IconRefresh size={18} /> {busy === "wx" ? "Filling" : "Fill"}</button>
                </div>
                <div className="two">
                  <Field id="temp" label="Temperature (°C)">
                    <input id="temp" className="input" inputMode="numeric" value={v.weather.tempC} onChange={(e) => update((d) => ({ ...d, weather: { ...d.weather, tempC: e.target.value.replace(/[^0-9.\-]/g, ""), source: "manual" } }))} placeholder="-12" />
                  </Field>
                  <Field id="snow" label="Snowfall, last 12 h (cm)">
                    <input id="snow" className="input" inputMode="decimal" value={v.weather.snowCm} onChange={(e) => update((d) => ({ ...d, weather: { ...d.weather, snowCm: e.target.value.replace(/[^0-9.]/g, ""), source: "manual" } }))} placeholder="0" />
                  </Field>
                </div>
                <p className="label">Conditions</p>
                <div className="chips">
                  {CONDITIONS.map((c) => <Chip key={c} on={v.weather.conditions === c} onClick={() => update((d) => ({ ...d, weather: { ...d.weather, conditions: c, source: "manual" } }))}>{c}</Chip>)}
                </div>
                <Field id="wind" label="Wind (km/h)">
                  <input id="wind" className="input" inputMode="numeric" value={v.weather.wind} onChange={(e) => update((d) => ({ ...d, weather: { ...d.weather, wind: e.target.value.replace(/[^0-9]/g, ""), source: "manual" } }))} placeholder="Optional" />
                </Field>
              </>
            )}

            {step === 4 && (
              <>
                <PhotoBlock kind="before" title="Before" hint="Snow and ice as you found it." list={before} onAdd={(f) => addPhotos(f, "before")} onOpen={setViewer} />
                <PhotoBlock kind="after" title="After" hint="Cleared and salted areas." list={after} onAdd={(f) => addPhotos(f, "after")} onOpen={setViewer} />
                <Field id="hazards" label="Hazards" hint="Ice build-up, drainage, damaged steps, anything the office should know.">
                  <textarea id="hazards" className="input area" rows={3} value={v.hazards} onChange={(e) => update((d) => ({ ...d, hazards: e.target.value }))} />
                </Field>
                <Field id="notes" label="Notes">
                  <textarea id="notes" className="input area" rows={3} value={v.notes} onChange={(e) => update((d) => ({ ...d, notes: e.target.value }))} />
                </Field>
              </>
            )}

            {step === 5 && (
              <>
                <dl className="sum">
                  <div><dt>Property</dt><dd>{v.property}</dd></div>
                  <div><dt>Time</dt><dd>{fmtDay(v.date, false)}, {fmtClock(v.start)} to {v.end ? fmtClock(v.end) : "..."} {zone}</dd></div>
                  <div><dt>Crew</dt><dd>{v.crew}</dd></div>
                  <div><dt>Cleared</dt><dd>{v.areas.filter((a) => a.done).length} of {v.areas.length} areas</dd></div>
                  <div><dt>Salt</dt><dd>{v.salt.filter(saltFilled).map((s) => `${s.product || "Product"} ${s.amount} ${s.amount ? s.unit : ""}`.trim()).join("; ") || "None"}</dd></div>
                  <div><dt>Weather</dt><dd>{[v.weather.tempC && `${v.weather.tempC} °C`, v.weather.conditions, v.weather.snowCm && `${v.weather.snowCm} cm`].filter(Boolean).join(", ") || "Not entered"}</dd></div>
                  <div><dt>Photos</dt><dd>{before.length} before, {after.length} after</dd></div>
                </dl>
                <div className="two">
                  <Field id="end2" label={`Finish (${zone})`}>
                    <div className="with-btn">
                      <input id="end2" type="time" className="input" value={v.end} onChange={(e) => update((d) => ({ ...d, end: e.target.value }))} />
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => update((d) => ({ ...d, end: siteTime() }))}>Now</button>
                    </div>
                  </Field>
                  <Field id="signRole" label="Role">
                    <input id="signRole" className="input" value={v.signRole} onChange={(e) => update((d) => ({ ...d, signRole: e.target.value }))} placeholder="e.g. Site supervisor" />
                  </Field>
                </div>
                <Field id="signName" label="Name of the person signing">
                  <input id="signName" className="input" value={v.signName} autoComplete="name" onChange={(e) => update((d) => ({ ...d, signName: e.target.value }))} />
                </Field>
                <p className="label">Signature</p>
                <p className="hint">I confirm the work above was done at this property at the times shown.</p>
                <SignaturePad label="Crew" value={v.signature} onChange={(s) => update((d) => ({ ...d, signature: s, signedAt: s ? new Date().toISOString() : "" }))} />
              </>
            )}

            <nav className="nav">
              <button type="button" className="btn btn-quiet" onClick={() => (step === 0 ? (setScreen("home"), scrollTop()) : go(step - 1))}><IconBack /> {step === 0 ? "Home" : "Back"}</button>
              {step < STEPS.length - 1
                ? <button type="button" className="btn btn-primary" onClick={next}>Next <IconNext /></button>
                : <button type="button" className="btn btn-primary" onClick={finish} disabled={busy === "pdf"}>{busy === "pdf" ? "Making report" : "Finish and make report"}</button>}
            </nav>
          </div>
        )}

        {/* ---------------- done ---------------- */}
        {screen === "done" && pdf && (
          <div className="done">
            <p className="eyebrow">Report {pdf.visit.id}</p>
            <h1 className="h2">Visit logged</h1>
            <p className="lede">{pdf.visit.property}, {fmtDay(pdf.visit.date, false)}. The signed PDF is ready.</p>
            <button type="button" className="btn btn-primary btn-xl" onClick={() => share(pdf)}><IconShare /> Email the report</button>
            <button type="button" className="btn btn-quiet btn-block" onClick={() => download(pdf)}><IconDownload /> Download PDF</button>
            <p className="note">This demo opens your phone&apos;s share sheet so you can pick Mail. In the full version the report is emailed to your office automatically as soon as the visit is signed off.</p>
            <button type="button" className="btn btn-quiet btn-block" onClick={() => start(true)}><IconPlus /> Start the next visit</button>
            <button type="button" className="link" onClick={() => { setScreen("history"); scrollTop(); }}>Past reports</button>
          </div>
        )}

        {/* ---------------- history ---------------- */}
        {screen === "history" && (
          <div className="hist">
            <p className="eyebrow">On this phone</p>
            <h1 className="h2">Past reports</h1>
            {history.length === 0 && <p className="lede">No reports yet.</p>}
            <ul className="hist-list">
              {history.map((h) => (
                <li key={h.id} className="hist-i">
                  <p className="card-t">{h.property || "Site"}</p>
                  <p className="card-s">{fmtDay(h.date, false)}, {fmtClock(h.start)}{h.end ? ` to ${fmtClock(h.end)}` : ""} {zoneAbbr(h.date)} · {h.id}</p>
                  <div className="row">
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => reopen(h.id, "share")} disabled={busy === `h-${h.id}`}><IconShare size={18} /> Share</button>
                    <button type="button" className="btn btn-quiet btn-sm" onClick={() => reopen(h.id, "download")} disabled={busy === `h-${h.id}`}><IconDownload size={18} /> PDF</button>
                    <button type="button" className="link link-danger" onClick={() => removeVisit(h.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-quiet btn-block" onClick={() => { setScreen("home"); scrollTop(); }}><IconBack /> Home</button>
          </div>
        )}
      </main>

      {viewer && <Viewer id={viewer} onClose={() => setViewer(null)} onRemove={() => removePhoto(viewer)} takenAt={v?.photos.find((p) => p.id === viewer)?.takenAt ?? ""} />}

      {msg && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="msg-t">
          <div className="modal-card">
            <h2 id="msg-t" className="h3">{msg.title}</h2>
            <p className="pre">{msg.body}</p>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setMsg(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- pieces with state */

function AddArea({ onAdd }: { onAdd: (label: string) => void }) {
  const [val, setVal] = useState("");
  const add = () => { const l = val.trim(); if (l) { onAdd(l); setVal(""); } };
  return (
    <div className="with-btn add-area">
      <label htmlFor="newarea" className="sr">Add another area</label>
      <input id="newarea" className="input" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} placeholder="Add another area, e.g. loading dock" />
      <button type="button" className="btn btn-quiet btn-sm" onClick={add} disabled={!val.trim()}>Add</button>
    </div>
  );
}

function PhotoBlock({ kind, title, hint, list, onAdd, onOpen }: { kind: PhotoKind; title: string; hint: string; list: { id: string; takenAt: string }[]; onAdd: (f: File[]) => Promise<void>; onOpen: (id: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const pick = async (fl: FileList | null) => {
    const files = Array.from(fl ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    setBusy(files.length);
    try { await onAdd(files); } finally { setBusy(0); if (ref.current) ref.current.value = ""; }
  };
  return (
    <section className="pblock" aria-labelledby={`pb-${kind}`}>
      <div className="pblock-h">
        <h2 id={`pb-${kind}`} className="h3">{title} <span className="count">{list.length}</span></h2>
        <p className="hint">{hint}</p>
      </div>
      {(list.length > 0 || busy > 0) && (
        <ul className="pgrid">
          {list.map((p, i) => (
            <li key={p.id}>
              <button type="button" className="pcell" onClick={() => onOpen(p.id)} aria-label={`${title} photo ${i + 1}, ${fmtStampTime(p.takenAt)}`}>
                <Thumb id={p.id} alt={`${title} photo ${i + 1}`} />
                <span className="pstamp">{fmtStampTime(p.takenAt)}</span>
              </button>
            </li>
          ))}
          {Array.from({ length: busy }).map((_, i) => <li key={`b${i}`}><span className="pcell pbusy">Saving</span></li>)}
        </ul>
      )}
      <button type="button" className="btn btn-quiet btn-block" onClick={() => ref.current?.click()} disabled={busy > 0} data-kind={kind}>
        <IconCamera /> {list.length ? `Add another ${title.toLowerCase()} photo` : `Add ${title.toLowerCase()} photo`}
      </button>
      <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => void pick(e.target.files)} data-photo-input={kind} />
    </section>
  );
}

function Viewer({ id, takenAt, onClose, onRemove }: { id: string; takenAt: string; onClose: () => void; onRemove: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { photoUrl(id, false).then(setSrc); }, [id]);
  const stamp = useMemo(() => fmtStamp(takenAt), [takenAt]);
  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src && <img src={src} alt="" />}
      <p className="viewer-stamp">{stamp}</p>
      <div className="viewer-bar">
        <button type="button" className="btn btn-quiet-dark" onClick={() => { if (confirm("Remove this photo?")) onRemove(); }}>Remove</button>
        <button type="button" className="btn btn-light" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

