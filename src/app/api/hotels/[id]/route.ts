import { deleteHotel, updateHotel } from "@/lib/db.ts";
import { refreshHotel } from "@/lib/importer.ts";

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE = ["name", "city", "country", "price", "currency", "checkin", "checkout", "washingMachine", "twinBeds"] as const;
const clean = (k: string, v: unknown) => {
  if (v === "" || v == null) return k === "currency" ? "EUR" : null;
  if (k === "price") return Number.isFinite(Number(v)) ? Number(v) : null;
  if (k === "washingMachine" || k === "twinBeds") return v === true || v === 1 || v === "1" ? 1 : v === false || v === 0 || v === "0" ? 0 : null;
  return String(v).trim();
};

export async function PATCH(req: Request, { params }: Ctx) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of EDITABLE) if (k in body) patch[k] = clean(k, body[k]);
  updateHotel(Number((await params).id), patch);
  return new Response(null, { status: 204 });
}

export async function POST(_: Request, { params }: Ctx) { // refresh details from the web
  const r = await refreshHotel(Number((await params).id));
  return r.ok ? new Response(null, { status: 204 }) : Response.json({ error: `Couldn't read the Booking.com page: ${r.reason}` }, { status: 502 });
}

export async function DELETE(_: Request, { params }: Ctx) {
  deleteHotel(Number((await params).id));
  return new Response(null, { status: 204 });
}
