import { extractHotelUrls, nameFromSlug, parseHotelHtml, type HotelMeta } from "./parse.ts";
import { hasHotel, insertHotel } from "./db.ts";

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

export async function importFromText(text: string): Promise<ImportResult> {
  const result: ImportResult = { added: [], skipped: [], partial: [] };
  const found = extractHotelUrls(text).slice(0, 100);
  for (const { key, url } of found) {
    if (hasHotel(key)) { result.skipped.push(key); continue; }
    const meta = await fetchMeta(url);
    insertHotel({
      key, url, source: "booking.com",
      name: meta?.name ?? nameFromSlug(key),
      address: meta?.address ?? null,
      country: meta?.country ?? key.split("/")[0].toUpperCase(),
      rating: meta?.rating ?? null,
      reviewCount: meta?.reviewCount ?? null,
      imageUrl: meta?.imageUrl ?? null,
      description: meta?.description ?? null,
      enriched: meta ? 1 : 0,
    });
    (meta ? result.added : result.partial).push(key);
  }
  return result;
}
