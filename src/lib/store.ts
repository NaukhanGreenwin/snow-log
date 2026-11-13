/* Everything stays on the phone.
   - The visit in progress: localStorage (small, synchronous, survives a refresh). Saved on every change.
   - Photos: JPEG bytes (ArrayBuffer) in IndexedDB "photos".
   - Finished visits: IndexedDB "visits" (the visit record; photos stay in "photos"), so the report
     can be opened and downloaded again later from History. */
import type { PhotoRecord, Visit } from "./types";

const DRAFT_KEY = "snowlog-draft-v1";
const DB_NAME = "snow-log";
const DB_VER = 1;

export function loadDraft(): Visit | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const r = JSON.parse(raw) as Visit;
    return r && r.v === 1 && r.id ? r : null;
  } catch { return null; }
}
export function saveDraft(r: Visit | null): boolean {
  try {
    if (!r) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(r));
    return true;
  } catch { return false; }
}

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos", { keyPath: "id" }).createIndex("visitId", "visitId");
      if (!d.objectStoreNames.contains("visits")) d.createObjectStore("visits", { keyPath: "id" });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => { dbp = null; rej(req.error); };
    req.onblocked = () => { dbp = null; rej(new Error("blocked")); };
  });
  return dbp;
}
function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  return db().then((d) => new Promise<T>((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => res(r ? (r as IDBRequest<T>).result : (undefined as T));
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  }));
}

export const putPhoto = (p: PhotoRecord) => tx<IDBValidKey>("photos", "readwrite", (s) => s.put(p));
export const getPhoto = (id: string) => tx<PhotoRecord | undefined>("photos", "readonly", (s) => s.get(id));
export const deletePhoto = (id: string) => { revokePhotoUrls(id); return tx<undefined>("photos", "readwrite", (s) => s.delete(id)); };

export function photoBlob(p: PhotoRecord, thumb = false): Blob | null {
  const data = thumb ? p.thumbData ?? p.data : p.data;
  return data ? new Blob([data], { type: "image/jpeg" }) : null;
}

export async function deletePhotosFor(visitId: string) {
  const ids = await tx<IDBValidKey[]>("photos", "readonly", (s) => s.index("visitId").getAllKeys(visitId));
  ids.forEach((id) => revokePhotoUrls(String(id)));
  await tx<undefined>("photos", "readwrite", (s) => { ids.forEach((id) => s.delete(id)); });
}

/* ---------- finished visits ---------- */
export const putVisit = (v: Visit) => tx<IDBValidKey>("visits", "readwrite", (s) => s.put(v));
export const getVisit = (id: string) => tx<Visit | undefined>("visits", "readonly", (s) => s.get(id));
export async function listVisits(): Promise<Visit[]> {
  const all = await tx<Visit[]>("visits", "readonly", (s) => s.getAll());
  return all.sort((a, b) => (b.completedAt || b.updatedAt).localeCompare(a.completedAt || a.updatedAt));
}
export async function deleteVisit(id: string) {
  await deletePhotosFor(id).catch(() => {});
  await tx<undefined>("visits", "readwrite", (s) => s.delete(id));
}

/** Photos that belong to no draft and no saved visit (e.g. a discarded draft). */
export async function prunePhotos(keep: Set<string>) {
  const all = await tx<PhotoRecord[]>("photos", "readonly", (s) => s.getAll());
  const drop = all.filter((p) => !keep.has(p.visitId)).map((p) => p.id);
  if (drop.length) await tx<undefined>("photos", "readwrite", (s) => { drop.forEach((id) => s.delete(id)); });
}

/** Can this browser keep photos at all? (Private Browsing on some iPhones cannot.) */
export async function storageWorks(): Promise<boolean> {
  try {
    const id = "probe-" + Math.random().toString(36).slice(2);
    await tx("photos", "readwrite", (s) => s.put({ id, visitId: "probe", kind: "before", data: new ArrayBuffer(8), w: 1, h: 1, takenAt: "" }));
    await tx("photos", "readwrite", (s) => s.delete(id));
    return true;
  } catch { return false; }
}

export async function requestPersistence() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch { /* ignore */ }
}

/* ---------- object URLs for photos, cached per session ---------- */
const urlCache = new Map<string, string>();
export async function photoUrl(id: string, thumb = true): Promise<string | null> {
  const k = `${id}:${thumb ? "t" : "f"}`;
  if (urlCache.has(k)) return urlCache.get(k)!;
  const p = await getPhoto(id).catch(() => undefined);
  const b = p && photoBlob(p, thumb);
  if (!b) return null;
  const u = URL.createObjectURL(b);
  urlCache.set(k, u);
  return u;
}
function revokePhotoUrls(id: string) {
  for (const k of [`${id}:t`, `${id}:f`]) { const u = urlCache.get(k); if (u) { URL.revokeObjectURL(u); urlCache.delete(k); } }
}

export const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
