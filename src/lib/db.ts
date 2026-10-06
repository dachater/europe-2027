import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface Hotel {
  id: number;
  key: string;
  source: string;
  url: string;
  name: string;
  address: string | null;
  country: string | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  description: string | null;
  enriched: number;
  createdAt: string;
}

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
  return (g.__db = d);
}

export const listHotels = () =>
  // node:sqlite rows have a null prototype; Next can only pass plain objects to client components
  db().prepare("SELECT * FROM hotels ORDER BY id DESC").all().map((r) => ({ ...r })) as unknown as Hotel[];

export function hasHotel(key: string): boolean {
  return !!db().prepare("SELECT 1 FROM hotels WHERE key = ?").get(key);
}

export function insertHotel(h: Omit<Hotel, "id" | "createdAt">): void {
  db().prepare(
    `INSERT INTO hotels (key, source, url, name, address, country, rating, reviewCount, imageUrl, description, enriched)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).run(h.key, h.source, h.url, h.name, h.address, h.country, h.rating, h.reviewCount, h.imageUrl, h.description, h.enriched);
}

export const deleteHotel = (id: number) => db().prepare("DELETE FROM hotels WHERE id = ?").run(id);
