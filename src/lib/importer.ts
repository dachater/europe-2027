import { extractHotelUrls, nameFromSlug, parseHotelHtml, type HotelMeta } from "./parse.ts";
import { fetchNearby } from "./geo.ts";
import { getHotel, hasHotel, insertHotel, updateHotel } from "./db.ts";

export interface ImportResult {
  added: string[];
  skipped: string[]; // already saved
  partial: string[]; // saved, but page details couldn't be fetched
}

async function fetchMeta(url: string): Promise<HotelMeta | null> {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; europe-2027-travel-app)", "accept-language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? parseHotelHtml(await res.text()) : null;
  } catch {
    return null;
  }
}

/** Fields we can fill from the page + OpenStreetMap. Never includes user-entered fields like price. */
async function enrich(url: string, key: string) {
  const meta = await fetchMeta(url);
  const nearby = meta?.lat != null && meta.lng != null ? await fetchNearby(meta.lat, meta.lng) : null;
  return {
    meta,
    fields: {
      name: meta?.name ?? nameFromSlug(key),
      address: meta?.address ?? null,
      country: meta?.country ?? key.split("/")[0].toUpperCase(),
      city: meta?.city ?? null,
      rating: meta?.rating ?? null,
      reviewCount: meta?.reviewCount ?? null,
      imageUrl: meta?.imageUrl ?? null,
      description: meta?.description ?? null,
      lat: meta?.lat ?? null,
      lng: meta?.lng ?? null,
      washingMachine: meta?.washingMachine ? 1 : null,
      twinBeds: meta?.twinBeds ? 1 : null,
      subway: nearby?.subway ?? null,
      attractions: nearby?.attractions ?? [],
      enriched: meta ? 1 : 0,
    },
  };
}

export async function importFromText(text: string): Promise<ImportResult> {
  const result: ImportResult = { added: [], skipped: [], partial: [] };
  for (const { key, url, checkin, checkout } of extractHotelUrls(text).slice(0, 100)) {
    if (hasHotel(key)) { result.skipped.push(key); continue; }
    const { meta, fields } = await enrich(url, key);
    insertHotel({ key, url, source: "booking.com", checkin, checkout, ...fields });
    (meta ? result.added : result.partial).push(key);
  }
  return result;
}

/** Re-fetch page details for a saved hotel. Only fills fields the user hasn't set, so manual edits survive. */
export async function refreshHotel(id: number): Promise<boolean> {
  const h = getHotel(id);
  if (!h) return false;
  const { meta, fields } = await enrich(h.url, h.key);
  if (!meta) return false;
  updateHotel(id, {
    ...fields,
    washingMachine: h.washingMachine ?? fields.washingMachine,
    twinBeds: h.twinBeds ?? fields.twinBeds,
    city: h.city ?? fields.city,
  });
  return true;
}
