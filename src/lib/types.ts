export type PhotoKind = "before" | "after";

export interface PhotoRecord {
  id: string;
  visitId: string;
  kind: PhotoKind;
  /** JPEG bytes, 1600px long edge (ArrayBuffer, never Blob: Safari private mode cannot store Blobs) */
  data: ArrayBuffer;
  thumbData?: ArrayBuffer;
  w: number;
  h: number;
  /** when the photo was added on the phone (ISO, UTC) */
  takenAt: string;
  /** legacy fields kept for photos.ts compatibility */
  reportId?: string;
  blob?: Blob;
  thumb?: Blob;
}

export interface Area { key: string; label: string; done: boolean; custom?: boolean }

export interface SaltEntry { id: string; product: string; amount: string; unit: string; areas: string }

export interface Weather {
  tempC: string;
  conditions: string;
  snowCm: string;
  wind: string;
  /** "open-meteo" when filled from the weather service (and not edited since), else "manual" */
  source: "open-meteo" | "manual" | "";
  fetchedAt: string;
}

export interface Gps { lat: number; lon: number; acc: number; at: string }

export interface Visit {
  v: 1;
  id: string;
  brand: string;
  createdAt: string;
  updatedAt: string;
  completedAt: string;
  property: string;
  address: string;
  /** visit date and times are local to the site (America/Edmonton): YYYY-MM-DD and HH:MM */
  date: string;
  start: string;
  end: string;
  crew: string;
  areas: Area[];
  methods: string[];
  salt: SaltEntry[];
  weather: Weather;
  gps: Gps | null;
  photos: { id: string; kind: PhotoKind; takenAt: string }[];
  hazards: string;
  notes: string;
  signName: string;
  signRole: string;
  signature: string;
  signedAt: string;
}
