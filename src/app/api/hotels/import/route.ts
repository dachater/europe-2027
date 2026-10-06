import { importFromText } from "@/lib/importer.ts";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { text } = (await req.json().catch(() => ({}))) as { text?: string };
  if (!text?.trim()) return Response.json({ error: "Paste at least one Booking.com property link." }, { status: 400 });
  const r = await importFromText(text);
  if (!r.added.length && !r.skipped.length && !r.partial.length)
    return Response.json({ error: "No Booking.com property links (…/hotel/xx/name.html) found." }, { status: 422 });
  return Response.json(r);
}
