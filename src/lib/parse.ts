export interface HotelMeta {
  name: string;
  address: string | null;
  country: string | null;
  rating: number | null;
  reviewCount: number | null;
  imageUrl: string | null;
  description: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  washingMachine: boolean | null; // null = not mentioned on the page (unknown)
  twinBeds: boolean | null;
}

const HOTEL_URL = /https?:\/\/(?:[a-z0-9-]+\.)?booking\.com\/hotel\/[a-z]{2}\/[a-z0-9_-]+(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html[^\s"'<>)]*/gi;

/** Canonical key: country + slug, ignoring language suffix and query string. */
export function hotelKey(url: string): string | null {
  const m = /\/hotel\/([a-z]{2})\/([a-z0-9_-]+?)(?:\.[a-z]{2}(?:-[a-z]{2})?)?\.html/i.exec(url);
  return m ? `${m[1].toLowerCase()}/${m[2].toLowerCase()}` : null;
}

/** Pull every distinct Booking.com property URL out of pasted text. */
export function extractHotelUrls(text: string): { key: string; url: string; checkin: string | null; checkout: string | null }[] {
  const seen = new Map<string, { url: string; checkin: string | null; checkout: string | null }>();
  for (const raw of text.match(HOTEL_URL) ?? []) {
    const key = hotelKey(raw);
    if (!key) continue;
    const checkin = /[?&;]checkin=(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1] ?? null;
    const checkout = /[?&;]checkout=(\d{4}-\d{2}-\d{2})/.exec(raw)?.[1] ?? null;
    const prev = seen.get(key);
    if (prev) { // later duplicate may carry the dates the first lacked
      prev.checkin ??= checkin; prev.checkout ??= checkout;
      continue;
    }
    const [cc, slug] = key.split("/");
    seen.set(key, { url: `https://www.booking.com/hotel/${cc}/${slug}.html`, checkin, checkout });
  }
  return [...seen].map(([key, v]) => ({ key, ...v }));
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function metaContent(html: string, prop: string): string | null {
  const tag = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, "i").exec(html)?.[0];
  const v = tag && /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return v ? decode(v).trim() || null : null;
}

function jsonLdNodes(html: string): Record<string, any>[] {
  const out: Record<string, any>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    try {
      const j = JSON.parse(m[1]);
      for (const n of Array.isArray(j) ? j : [j]) {
        out.push(n, ...(Array.isArray(n?.["@graph"]) ? n["@graph"] : []));
      }
    } catch { /* ignore malformed block */ }
  }
  return out;
}

const num = (v: unknown) => (v == null || v === "" || isNaN(Number(v)) ? null : Number(v));

export function parseHotelHtml(html: string): HotelMeta | null {
  const node = jsonLdNodes(html).find((n) => /Hotel|LodgingBusiness|BedAndBreakfast|Hostel|Resort|Apartment/i.test(String(n["@type"])));
  const ogTitle = metaContent(html, "og:title");
  const name = (node?.name as string | undefined) ?? ogTitle?.split(/\s+[-–|,]\s+/)[0] ?? null;
  if (!name) return null;

  const a = node?.address;
  const address = a ? (typeof a === "string" ? a : [a.streetAddress, a.postalCode, a.addressLocality].filter(Boolean).join(", ")) : null;
  const image = Array.isArray(node?.image) ? node?.image[0] : node?.image;
  const latlng = /data-atlas-latlng=["']\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/.exec(html);
  const lat = num(node?.geo?.latitude) ?? (latlng ? Number(latlng[1]) : null);
  const lng = num(node?.geo?.longitude) ?? (latlng ? Number(latlng[2]) : null);
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, " ");
  const country = (a && typeof a === "object" && (a.addressCountry?.name ?? a.addressCountry)) || null;
  return {
    city: (a && typeof a === "object" && a.addressLocality) || null,
    lat, lng,
    washingMachine: /washing machine|washer\b/i.test(text) ? true : null,
    twinBeds: /twin beds?|2 single beds?|two single beds?/i.test(text) ? true : null,
    name: decode(String(name)).trim(),
    address: address || null,
    country,
    rating: num(node?.aggregateRating?.ratingValue),
    reviewCount: num(node?.aggregateRating?.reviewCount),
    imageUrl: (image as string | undefined) ?? metaContent(html, "og:image"),
    description: (node?.description as string | undefined) ?? metaContent(html, "og:description"),
  };
}

/** Fallback when the page can't be fetched: derive a readable name from the URL slug. */
export function nameFromSlug(key: string): string {
  return key.split("/")[1].replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
