import { ShoppingList } from "@/components/shopping-list";
import { ToastProvider } from "@/components/toast";
import { getListName, listItems } from "@/lib/items";
import { getListId } from "@/lib/session";
import type { Item } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Signed-in devices get their saved list; everyone else gets a device-only list.
  let listId = await getListId();
  const listName = listId ? await getListName(listId) : null;
  if (!listName) listId = null; // list was deleted: treat this device as signed out

  const items: Item[] = listId ? await listItems(listId) : [];

  return (
    <ToastProvider>
      {/* key remounts the list when switching between device-only and saved */}
      <ShoppingList key={listId ?? "device"} initialItems={items} listName={listId ? listName : null} />
    </ToastProvider>
  );
}
