import { listHotels } from "@/lib/db.ts";

export const dynamic = "force-dynamic";
export const GET = () => Response.json(listHotels());
