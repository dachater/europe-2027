export interface Nearby {
  subway: { name: string; meters: number } | null;
  attractions: { name: string; meters: number }[];
}

export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return Math.round(12742000 * Math.asin(Math.sqrt(a)));
}

export function overpassQuery(lat: number, lng: number): string {
  return `[out:json][timeout:20];(
    nwr(around:3000,${lat},${lng})["railway"="station"]["station"="subway"];
    nwr(around:3000,${lat},${lng})["railway"="subway_entrance"];
    nwr(around:3000,${lat},${lng})["railway"="station"]["subway"="yes"];
    nwr(around:2500,${lat},${lng})["tourism"~"^(attraction|museum|gallery)$"]["wikidata"]["name"];
    nwr(around:2500,${lat},${lng})["historic"~"^(monument|castle|cathedral|palace)$"]["wikidata"]["name"];
  );out center 300;`;
}

export function parseOverpass(elements: any[], lat: number, lng: number): Nearby {
  const pts = elements
    .map((e) => ({
      tags: e.tags ?? {},
      lat: e.lat ?? e.center?.lat,
      lng: e.lon ?? e.center?.lon,
    }))
    .filter((p) => p.lat != null && p.lng != null && p.tags.name)
    .map((p) => ({ ...p, meters: haversine(lat, lng, p.lat, p.lng) }))
    .sort((a, b) => a.meters - b.meters);

  const isSubway = (t: any) => t.railway === "subway_entrance" || t.station === "subway" || t.subway === "yes";
  const sub = pts.find((p) => isSubway(p.tags));
  const seen = new Set<string>();
  const attractions = pts
    .filter((p) => !isSubway(p.tags) && (p.tags.tourism || p.tags.historic))
    .filter((p) => !seen.has(p.tags.name) && !!seen.add(p.tags.name))
    .slice(0, 3)
    .map((p) => ({ name: p.tags.name as string, meters: p.meters }));
  return { subway: sub ? { name: sub.tags.name, meters: sub.meters } : null, attractions };
}

export async function fetchNearby(lat: number, lng: number): Promise<Nearby | null> {
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": "europe-2027-travel-app" },
      body: "data=" + encodeURIComponent(overpassQuery(lat, lng)),
      signal: AbortSignal.timeout(25000),
    });
    if (!res.ok) return null;
    return parseOverpass((await res.json()).elements ?? [], lat, lng);
  } catch {
    return null;
  }
}

export const fmtDistance = (m: number) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
