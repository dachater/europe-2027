import { extractHotelUrls, nameFromSlug, parseHotelHtml, type HotelMeta } from "./parse.ts";
import { fetchNearby } from "./geo.ts";
import { getHotel, hasHotel, insertHotel, updateHotel } from "./db.ts";

export interface ImportResult {
  added: string[];
  skipped: string[]; // already saved
  partial: string[]; // saved, but page details couldn't be fetched
}

export interface Fetched { meta: HotelMeta | null; reason: string | null }

async function fetchMeta(url: string): Promise<Fetched> {
  let reason: string;
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(10000),
    });
    const html = await res.text();
    if (res.ok) {
      const meta = parseHotelHtml(html);
      if (meta) return { meta, reason: null };
      reason = `page loaded (HTTP ${res.status}, ${html.length} bytes) but no hotel details found` +
        (/captcha|robot|verify|challenge/i.test(html) ? " — looks like a bot-check page" : "");
    } else {
      reason = `Booking.com answered HTTP ${res.status}` + (res.status === 403 || res.status === 202 ? " (blocking automated requests)" : "");
    }
  } catch (e) {
    reason = `request failed: ${(e as Error).message}`;
  }
  console.warn(`[booking fetch] ${url} → ${reason}`);
  return { meta: null, reason };
}

/** Fields we can fill from the page + OpenStreetMap. Never includes user-entered fields like price. */
async function enrich(url: string, key: string) {
  const { meta, reason } = await fetchMeta(url);
  const nearby = meta?.lat != null && meta.lng != null ? await fetchNearby(meta.lat, meta.lng) : null;
  return {
    meta,
    reason,
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
export async function refreshHotel(id: number): Promise<{ ok: boolean; reason?: string }> {
  const h = getHotel(id);
  if (!h) return { ok: false, reason: "hotel not found" };
  const { meta, reason, fields } = await enrich(h.url, h.key);
  if (!meta) return { ok: false, reason: reason ?? "unknown" };
  updateHotel(id, {
    ...fields,
    washingMachine: h.washingMachine ?? fields.washingMachine,
    twinBeds: h.twinBeds ?? fields.twinBeds,
    city: h.city ?? fields.city,
  });
  return { ok: true };
}
