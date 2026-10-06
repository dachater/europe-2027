import { listHotels } from "@/lib/db.ts";
import HotelsClient from "./HotelsClient.tsx";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main>
      <h1>Hotels &amp; guesthouses</h1>
      <p className="sub">Import your Booking.com favorites by pasting property links.</p>
      <HotelsClient initial={listHotels()} />
    </main>
  );
}
