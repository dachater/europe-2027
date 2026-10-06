import Link from "next/link";
import { listHotels } from "@/lib/db.ts";
import SummaryClient from "./SummaryClient.tsx";

export const dynamic = "force-dynamic";

export default function SummaryPage() {
  return (
    <main className="wide">
      <p><Link href="/">← Import hotels</Link></p>
      <h1>Summary by place</h1>
      <p className="sub">Click any cell to edit. “?” means unknown — the page didn’t say.</p>
      <SummaryClient hotels={listHotels()} />
    </main>
  );
}
