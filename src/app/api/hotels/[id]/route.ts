import { deleteHotel } from "@/lib/db.ts";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  deleteHotel(Number((await params).id));
  return new Response(null, { status: 204 });
}
