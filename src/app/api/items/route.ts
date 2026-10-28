import { NextResponse } from "next/server";
import { listItems } from "@/lib/items";
import { getListId } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Polled by every signed-in device to pick up changes made elsewhere. */
export async function GET() {
  const listId = await getListId();
  if (!listId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const items = await listItems(listId);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[GET /api/items]", err);
    return NextResponse.json({ error: "Couldn't load items" }, { status: 500 });
  }
}
