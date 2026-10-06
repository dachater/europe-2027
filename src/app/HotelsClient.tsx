"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Hotel } from "@/lib/db.ts";

export default function HotelsClient({ initial }: { initial: Hotel[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);

  async function doImport() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/hotels/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    const j = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ text: j.error, err: true });
    setText("");
    const parts = [`${j.added.length + j.partial.length} added`, j.skipped.length && `${j.skipped.length} already saved`, j.partial.length && `${j.partial.length} saved with limited details (page couldn't be read)`];
    setMsg({ text: parts.filter(Boolean).join(" · ") });
    router.refresh();
  }

  async function remove(id: number) {
    await fetch(`/api/hotels/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste one or more booking.com/hotel/… links (one per line, or any text containing them)" />
      <p><button onClick={doImport} disabled={busy || !text.trim()}>{busy ? "Importing…" : "Import"}</button></p>
      {msg && <p className={`msg ${msg.err ? "err" : ""}`}>{msg.text}</p>}
      <div className="grid">
        {initial.map((h) => (
          <div className="card" key={h.id}>
            {h.imageUrl ? <img src={h.imageUrl} alt="" loading="lazy" /> : <div className="noimg" />}
            <div className="body">
              <h3>{h.name}</h3>
              <div className="meta">
                {h.rating != null && <span className="badge">{h.rating.toFixed(1)}</span>}
                {h.reviewCount != null && <span>{h.reviewCount} reviews · </span>}
                {[h.address, h.country].filter(Boolean).join(", ")}
              </div>
            </div>
            <div className="foot">
              <a href={h.url} target="_blank" rel="noreferrer">Booking.com ↗</a>
              <button className="ghost" onClick={() => remove(h.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
      {!initial.length && <p className="msg">No hotels yet.</p>}
    </>
  );
}
