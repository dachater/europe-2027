"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Hotel } from "@/lib/db.ts";
import { fmtDistance } from "@/lib/geo.ts";

const nights = (h: Hotel) =>
  h.checkin && h.checkout ? Math.round((Date.parse(h.checkout) - Date.parse(h.checkin)) / 864e5) : null;

const triToValue = (v: number | null) => (v == null ? "" : String(v));

export default function SummaryClient({ hotels }: { hotels: Hotel[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(id: number, field: string, value: string) {
    await fetch(`/api/hotels/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ [field]: value }) });
    router.refresh();
  }

  async function refresh(id: number) {
    setBusy(id); setErr(null);
    const res = await fetch(`/api/hotels/${id}`, { method: "POST" });
    setBusy(null);
    if (!res.ok) setErr((await res.json()).error);
    router.refresh();
  }

  const groups = new Map<string, Hotel[]>();
  for (const h of hotels) {
    const k = h.city || "Unknown city";
    groups.set(k, [...(groups.get(k) ?? []), h]);
  }
  const ordered = [...groups].sort(([a], [b]) => (a === "Unknown city" ? 1 : b === "Unknown city" ? -1 : a.localeCompare(b)));

  if (!hotels.length) return <p className="msg">No hotels yet — import some first.</p>;

  const tri = (h: Hotel, f: "washingMachine" | "twinBeds") => (
    <select defaultValue={triToValue(h[f])} onChange={(e) => save(h.id, f, e.target.value)} aria-label={f}>
      <option value="">?</option><option value="1">Yes</option><option value="0">No</option>
    </select>
  );

  return (
    <>
      {err && <p className="msg err">{err}</p>}
      {ordered.map(([city, list]) => (
        <section key={city}>
          <h2>{city} <span className="meta">· {list.length} {list.length === 1 ? "place" : "places"}{list[0]?.country ? ` · ${list[0].country}` : ""}</span></h2>
          <div className="scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Cost</th><th>Dates</th><th>Washing machine</th><th>Twin beds</th><th>Nearest attractions</th><th>Nearest subway</th><th /></tr>
              </thead>
              <tbody>
                {list.map((h) => {
                  const n = nights(h);
                  return (
                    <tr key={h.id}>
                      <td>
                        <a href={h.url} target="_blank" rel="noreferrer">{h.name}</a>
                        <input className="city" defaultValue={h.city ?? ""} placeholder="city" onBlur={(e) => e.target.value !== (h.city ?? "") && save(h.id, "city", e.target.value)} aria-label="city" />
                      </td>
                      <td>
                        <input type="number" min="0" step="any" className="num" defaultValue={h.price ?? ""} placeholder="total" onBlur={(e) => e.target.value !== String(h.price ?? "") && save(h.id, "price", e.target.value)} aria-label="total price" />
                        <input className="cur" defaultValue={h.currency} maxLength={3} onBlur={(e) => e.target.value !== h.currency && save(h.id, "currency", e.target.value.toUpperCase())} aria-label="currency" />
                        {h.price != null && n && n > 0 && <div className="meta">{(h.price / n).toFixed(0)} {h.currency}/night</div>}
                      </td>
                      <td>
                        <input type="date" defaultValue={h.checkin ?? ""} onChange={(e) => save(h.id, "checkin", e.target.value)} aria-label="check-in" />
                        <input type="date" defaultValue={h.checkout ?? ""} onChange={(e) => save(h.id, "checkout", e.target.value)} aria-label="check-out" />
                        {n != null && n > 0 && <div className="meta">{n} night{n > 1 ? "s" : ""}</div>}
                      </td>
                      <td>{tri(h, "washingMachine")}</td>
                      <td>{tri(h, "twinBeds")}</td>
                      <td>
                        {h.attractions.length ? h.attractions.map((a) => <div key={a.name}>{a.name} <span className="meta">{fmtDistance(a.meters)}</span></div>) : <span className="meta">{h.lat == null ? "no location" : "none found"}</span>}
                      </td>
                      <td>{h.subway ? <>{h.subway.name} <span className="meta">{fmtDistance(h.subway.meters)}</span></> : <span className="meta">{h.lat == null ? "no location" : "none found"}</span>}</td>
                      <td><button className="ghost" disabled={busy === h.id} onClick={() => refresh(h.id)} title="Re-read the Booking.com page and look up distances">{busy === h.id ? "…" : "Refresh"}</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
