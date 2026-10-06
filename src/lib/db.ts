import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Place { name: string; meters: number }

export interface Hotel {
  id: number;
  key: string;
  source: string;
  url: string;
  name: string;
  address: string | null;
  country: string | null;
  city: string | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  description: string | null;
  enriched: number;
  createdAt: string;
  lat: number | null;
  lng: number | null;
  price: number | null; // total for the stay
  currency: string;
  checkin: string | null;
  checkout: string | null;
  washingMachine: number | null; // 1 yes, 0 no, null unknown
  twinBeds: number | null;
  subway: Place | null;
  attractions: Place[];
}

const COLUMNS: [string, string][] = [
  ["city", "TEXT"], ["lat", "REAL"], ["lng", "REAL"], ["price", "REAL"],
  ["currency", "TEXT NOT NULL DEFAULT 'EUR'"], ["checkin", "TEXT"], ["checkout", "TEXT"],
  ["washingMachine", "INTEGER"], ["twinBeds", "INTEGER"],
  ["subway", "TEXT"], ["attractions", "TEXT"], // JSON
];

const g = globalThis as unknown as { __db?: DatabaseSync };

export function db(): DatabaseSync {
  if (g.__db) return g.__db;
  const file = process.env.DB_PATH ?? "data/travel.db";
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
  const d = new DatabaseSync(file);
  d.exec(`CREATE TABLE IF NOT EXISTS hotels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL DEFAULT 'booking.com',
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    address TEXT, country TEXT, rating REAL, reviewCount INTEGER,
    imageUrl TEXT, description TEXT,
    enriched INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const have = new Set((d.prepare("PRAGMA table_info(hotels)").all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of COLUMNS) if (!have.has(name)) d.exec(`ALTER TABLE hotels ADD COLUMN ${name} ${type}`);
  return (g.__db = d);
}

function hydrate(r: Record<string, any>): Hotel {
  return { ...r, subway: r.subway ? JSON.parse(r.subway) : null, attractions: r.attractions ? JSON.parse(r.attractions) : [] } as Hotel;
}

// node:sqlite rows have a null prototype; hydrate() also makes them plain objects for client components
export const listHotels = () => db().prepare("SELECT * FROM hotels ORDER BY id DESC").all().map((r) => hydrate({ ...r }));

export const getHotel = (id: number) => {
  const r = db().prepare("SELECT * FROM hotels WHERE id = ?").get(id);
  return r ? hydrate({ ...r }) : null;
};

export function hasHotel(key: string): boolean {
  return !!db().prepare("SELECT 1 FROM hotels WHERE key = ?").get(key);
}

export type HotelInput = Partial<Omit<Hotel, "id" | "createdAt">> & Pick<Hotel, "key" | "url" | "name">;

const WRITABLE = [
  "key", "source", "url", "name", "address", "country", "city", "rating", "reviewCount", "imageUrl", "description",
  "enriched", "lat", "lng", "price", "currency", "checkin", "checkout", "washingMachine", "twinBeds", "subway", "attractions",
] as const;

const toDb = (k: string, v: unknown) => (v === undefined ? null : k === "subway" || k === "attractions" ? (v == null ? null : JSON.stringify(v)) : v);

export function insertHotel(h: HotelInput): void {
  const cols = WRITABLE.filter((c) => h[c] !== undefined);
  db().prepare(`INSERT INTO hotels (${cols.join(",")}) VALUES (${cols.map(() => "?").join(",")})`).run(...(cols.map((c) => toDb(c, h[c])) as any[]));
}

/** Update only the given fields (values may be null to clear). */
export function updateHotel(id: number, patch: Partial<Record<(typeof WRITABLE)[number], unknown>>): void {
  const cols = WRITABLE.filter((c) => c in patch);
  if (!cols.length) return;
  db().prepare(`UPDATE hotels SET ${cols.map((c) => `${c} = ?`).join(",")} WHERE id = ?`).run(...(cols.map((c) => toDb(c, patch[c])) as any[]), id);
}

export const deleteHotel = (id: number) => db().prepare("DELETE FROM hotels WHERE id = ?").run(id);
