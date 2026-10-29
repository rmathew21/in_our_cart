"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logOut } from "@/app/account-actions";
import { addItem, deleteItem, restoreItem, setCompleted, updateItem } from "@/app/actions";
import { loadDeviceItems, saveDeviceItems } from "@/lib/device-storage";
import type { ActionResult, Item } from "@/lib/types";
import { AddItemForm } from "./add-item-form";
import { ItemRow } from "./item-row";
import { PhoneIcon } from "./icons";
import { Logo } from "./logo";
import { SaveDialog, type SaveMode } from "./save-dialog";
import { useToast } from "./toast";
import { useNow } from "./use-now";

const POLL_MS = 5_000;

/** Replace (or remove, when next is null) the item with this id. Order is applied at render. */
function upsert(list: Item[], id: string, next: Item | null): Item[] {
  const rest = list.filter((i) => i.id !== id);
  return next ? [...rest, next] : rest;
}

function fingerprint(list: Item[]): string {
  return list
    .map((i) => `${i.id}:${i.updatedAt}:${i.completed ? 1 : 0}`)
    .sort()
    .join("|");
}

type MutationOptions<T> = {
  id: string;
  optimistic: Item | null;
  action: () => Promise<ActionResult<T>>;
  confirmed: (data: T) => Item | null;
  fallbackError: string;
};

type Props = {
  initialItems: Item[];
  /** Set when this device is logged in to a saved list; null means items live on this device only. */
  listName: string | null;
};

export function ShoppingList({ initialItems, listName }: Props) {
  const saved = listName !== null;
  const { toast } = useToast();
  const now = useNow(15_000);

  const [items, setItemsState] = useState<Item[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [ready, setReady] = useState(saved); // device lists load from localStorage after mount
  const [saveMode, setSaveMode] = useState<SaveMode | null>(null);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const arrivingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Refs mirror state synchronously so rapid taps and polling see the latest values.
  const itemsRef = useRef(items);
  const editingRef = useRef(editingId);
  const inFlight = useRef(0);
  const mutationSeq = useRef(0);
  const latestForId = useRef(new Map<string, number>());
  const handedOff = useRef(false); // device items were moved to the server; stop writing them locally

  const commit = useCallback((update: (cur: Item[]) => Item[]) => {
    const next = update(itemsRef.current);
    if (next === itemsRef.current) return;
    itemsRef.current = next;
    setItemsState(next);
  }, []);

  const startEdit = useCallback((id: string) => {
    editingRef.current = id;
    setEditingId(id);
  }, []);
  const stopEdit = useCallback(() => {
    editingRef.current = null;
    setEditingId(null);
  }, []);

  const mutate = useCallback(
    async <T,>({ id, optimistic, action, confirmed, fallbackError }: MutationOptions<T>) => {
      if (!saved) {
        commit((cur) => upsert(cur, id, optimistic));
        return;
      }
      const previous = itemsRef.current.find((i) => i.id === id) ?? null;
      const token = ++mutationSeq.current;
      latestForId.current.set(id, token);
      inFlight.current++;
      commit((cur) => upsert(cur, id, optimistic));

      const isLatest = () => latestForId.current.get(id) === token;
      try {
        const res = await action();
        if (res.ok) {
          if (isLatest()) commit((cur) => upsert(cur, id, confirmed(res.data)));
        } else if (res.unauthorized) {
          window.location.reload();
        } else {
          if (isLatest()) commit((cur) => upsert(cur, id, previous));
          toast(res.error);
        }
      } catch {
        if (isLatest()) commit((cur) => upsert(cur, id, previous));
        toast(fallbackError);
      } finally {
        inFlight.current--;
        mutationSeq.current++;
        if (isLatest()) latestForId.current.delete(id);
      }
    },
    [commit, toast, saved],
  );

  // ---- Device-only storage -------------------------------------------------

  useEffect(() => {
    if (saved) return;
    commit(() => loadDeviceItems());
    setReady(true);
  }, [saved, commit]);

  useEffect(() => {
    if (!saved && ready && !handedOff.current) saveDeviceItems(items);
  }, [items, saved, ready]);

  // ---- Actions ------------------------------------------------------------

  const handleAdd = useCallback(
    (input: { name: string; quantity: string | null; notes: string | null }) => {
      const id = crypto.randomUUID();
      const stamp = new Date().toISOString();
      void mutate({
        id,
        optimistic: { id, ...input, completed: false, completedAt: null, createdAt: stamp, updatedAt: stamp },
        action: () => addItem({ id, ...input }),
        confirmed: (item) => item,
        fallbackError: `Couldn't add ${input.name}. Check your connection and try again.`,
      });
    },
    [mutate],
  );

  const markArriving = useCallback((id: string) => {
    clearTimeout(arrivingTimer.current);
    setArrivingId(id);
    arrivingTimer.current = setTimeout(() => setArrivingId(null), 900);
  }, []);
  useEffect(() => () => clearTimeout(arrivingTimer.current), []);

  const handleToggle = useCallback(
    (item: Item) => {
      const completed = !item.completed;
      markArriving(item.id);
      const stamp = new Date().toISOString();
      void mutate({
        id: item.id,
        optimistic: { ...item, completed, completedAt: completed ? stamp : null, updatedAt: stamp },
        action: () => setCompleted(item.id, completed),
        confirmed: (next) => next,
        fallbackError: `Couldn't update ${item.name}. Check your connection and try again.`,
      });
    },
    [mutate, markArriving],
  );

  const handleSave = useCallback(
    (input: { id: string; name: string; quantity: string | null; notes: string | null }) => {
      const current = itemsRef.current.find((i) => i.id === input.id);
      if (!current) return;
      if (current.name === input.name && current.quantity === input.quantity && current.notes === input.notes) return;
      void mutate({
        id: input.id,
        optimistic: { ...current, ...input, updatedAt: new Date().toISOString() },
        action: () => updateItem(input),
        confirmed: (next) => next,
        fallbackError: `Couldn't save ${input.name}. Check your connection and try again.`,
      });
    },
    [mutate],
  );

  const handleDelete = useCallback(
    (item: Item) => {
      void mutate({
        id: item.id,
        optimistic: null,
        action: () => deleteItem(item.id),
        confirmed: () => null,
        fallbackError: `Couldn't delete ${item.name}. Check your connection and try again.`,
      });
    },
    [mutate],
  );

  const handleRestore = useCallback(
    (item: Item) => {
      markArriving(item.id);
      void mutate({
        id: item.id,
        optimistic: item,
        action: () => restoreItem(item),
        confirmed: (restored) => restored,
        fallbackError: `Couldn't bring back ${item.name}. Add it again.`,
      });
    },
    [mutate, markArriving],
  );

  /** Swipe left deletes right away and offers Undo instead of asking first. */
  const handleSwipeDelete = useCallback(
    (item: Item) => {
      handleDelete(item);
      toast(`Deleted ${item.name}`, { label: "Undo", onAction: () => handleRestore(item) });
    },
    [handleDelete, handleRestore, toast],
  );

  // ---- Multi-device sync (polling) ---------------------------------------

  useEffect(() => {
    if (!saved) return;
    let controller: AbortController | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      const seqAtStart = mutationSeq.current;
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch("/api/items", { cache: "no-store", signal: controller.signal });
        if (res.status === 401) {
          window.location.reload();
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { items: Item[] };

        // Drop stale responses: a local change started or finished while we were fetching.
        if (inFlight.current > 0 || seqAtStart !== mutationSeq.current) return;

        commit((cur) => {
          let next = body.items;
          // Keep the row being edited on screen even if another device deleted it.
          const editing = editingRef.current;
          if (editing && !next.some((i) => i.id === editing)) {
            const local = cur.find((i) => i.id === editing);
            if (local) next = [...next, local];
          }
          return fingerprint(next) === fingerprint(cur) ? cur : next;
        });
      } catch {
        // Offline or aborted: try again next tick.
      }
    }

    function start() {
      clearInterval(timer);
      timer = setInterval(poll, POLL_MS);
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void poll();
        start();
      } else {
        clearInterval(timer);
        controller?.abort();
      }
    }
    const onFocus = () => void poll();

    start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [commit, saved]);

  // ---- Render -------------------------------------------------------------

  const { active, done } = useMemo(() => {
    const active = items
      .filter((i) => !i.completed)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const done = items
      .filter((i) => i.completed)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
    return { active, done };
  }, [items]);

  const rowProps = {
    now,
    onToggle: handleToggle,
    onStartEdit: startEdit,
    onStopEdit: stopEdit,
    onSave: handleSave,
    onDelete: handleDelete,
    onSwipeDelete: handleSwipeDelete,
  };

  const countLabel = !ready
    ? ""
    : active.length === 0
      ? done.length > 0
        ? "All done"
        : "Nothing yet"
      : `${active.length} to get`;

  // return (
  //   <div className="mx-auto min-h-dvh max-w-xl pb-[calc(env(safe-area-inset-bottom)+5rem)]">
  //     <header className="sticky top-0 z-20 border-b border-line bg-paper/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
  //       <div className="mb-3 flex items-center justify-between gap-4">
  //         <div className="min-w-0">
  //           <h1>
  //             <Logo />
  //           </h1>
  //           {listName ? <p className="mt-1 truncate pl-12 text-sm text-muted">{listName}</p> : null}
  //         </div>
  //         <p className="text-sm font-medium text-muted" aria-live="polite">
  //           {countLabel}
  //         </p>
  //       </div>
  //       <AddItemForm onAdd={handleAdd} />
  //     </header>

  //     <main className="px-4">
  //       {!saved ? (
  //         <section
  //           aria-labelledby="save-heading"
  //           className="mt-5 rounded-2xl border-2 border-leaf/40 bg-surface p-4"
  //         >
  //           <h2 id="save-heading" className="font-display text-lg font-bold">
  //             Only saved on this device
  //           </h2>
  //           <p className="mt-1 text-sm text-muted">
  //             Save it with a list name and PIN to open it on your phone, laptop, or anyone else&apos;s in your
  //             household.
  //           </p>
  //           <div className="mt-4 flex flex-wrap gap-2">
  //             <button
  //               type="button"
  //               onClick={() => setSaveMode("signup")}
  //               className="h-12 flex-1 rounded-xl bg-leaf px-4 font-semibold text-leaf-ink"
  //             >
  //               Save my list
  //             </button>
  //             <button
  //               type="button"
  //               onClick={() => setSaveMode("login")}
  //               className="h-12 flex-1 rounded-xl border border-line px-4 font-semibold"
  //             >
  //               Log in
  //             </button>
  //           </div>
  //         </section>
  //       ) : null}

    return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <h1>
          <Logo />
        </h1>
        {saved ? (
          <form action={logOut}>
            <button type="submit" className="h-11 rounded-xl border border-line px-4 text-[15px] font-semibold">
              Log out
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setSaveMode("login")}
            className="h-11 rounded-xl border border-line px-4 text-[15px] font-semibold"
          >
            Log in
          </button>
        )}
      </header>

      <main className="flex-1 px-4">
        {saved ? (
          <div className="mt-5 flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-muted">Shared list</p>
              <p className="truncate font-display text-[1.65rem] font-extrabold leading-tight tracking-tight">
                {listName}
              </p>
            </div>
            <p className="shrink-0 pb-1 text-sm font-semibold text-muted" aria-live="polite">
              {countLabel}
            </p>
          </div>
        ) : (
          <>
            <section aria-labelledby="intro-heading" className="mt-6">
              <h2 id="intro-heading" className="font-display text-[1.9rem] font-extrabold leading-[1.08] tracking-tight">
                One list for everyone at home
              </h2>
              <p className="mt-2.5 text-muted">
                Anyone in your household can add what you need, from wherever they are. Whoever heads to the store has
                the complete list.
              </p>
            </section>

            <section aria-labelledby="save-heading" className="mt-5 rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-3">
                <PhoneIcon className="mt-0.5 h-5 w-5 shrink-0 text-tag-ink" />
                <div>
                  <h2 id="save-heading" className="font-semibold">
                    Saved on this device only
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Save your list with a name and PIN so everyone in your home can log in, add items, and see
                    what&apos;s been picked up.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSaveMode("signup")}
                className="mt-3 h-12 w-full rounded-xl bg-leaf font-semibold text-leaf-ink"
              >
                Save my list
              </button>
            </section>
          </>
        )}

        {/* <section aria-labelledby="add-heading" className="mt-6">
          <div className={saved ? "" : "mb-2 flex items-baseline justify-between gap-3"}>
            <h2 id="add-heading" className={saved ? "sr-only" : "font-display text-xl font-bold"}>
              Add to your list
            </h2>
            {!saved ? (
              <p className="text-sm font-semibold text-muted" aria-live="polite">
                {countLabel}
              </p>
            ) : null}
          </div>
          <AddItemForm onAdd={handleAdd} />
        </section> */}

        {/* Heading scrolls away; the add bar below it pins under the header once it reaches the top. */}
        <div className={saved ? "mt-4" : "mt-6 mb-1 flex items-baseline justify-between gap-3"}>
          <h2 className={saved ? "sr-only" : "font-display text-xl font-bold"}>Add to your list</h2>
          {!saved ? (
            <p className="text-sm font-semibold text-muted" aria-live="polite">
              {countLabel}
            </p>
          ) : null}
        </div>
        <div className="sticky top-[calc(env(safe-area-inset-top)+4.25rem+1px)] z-10 -mx-4 bg-paper/95 px-4 pt-2 backdrop-blur">
          <AddItemForm onAdd={handleAdd} />
        </div>

        {ready ? (
          <>
            <section aria-labelledby="to-get-heading" className="mt-5">
              <h2 id="to-get-heading" className="sr-only">
                To get
              </h2>
              {active.length > 0 ? (
                <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {active.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      arriving={arrivingId === item.id}
                      {...rowProps}
                    />
                  ))}
                </ul>
              ) : (
                <div className="rounded-2xl border border-dashed border-line px-5 py-8 text-center">
                  <p className="font-display text-xl font-bold">
                    {done.length > 0 ? "Everything's in the cart." : "Your list is empty."}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {done.length > 0 ? "Add something above if you think of it." : "Type the first thing you need above."}
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="in-cart-heading" className="mt-8">
              <h2 id="in-cart-heading" className="mb-2 flex items-baseline gap-2 px-1 font-display text-xl font-bold">
                In the cart
                {done.length > 0 ? <span className="text-sm font-medium text-muted">({done.length})</span> : null}
              </h2>
              {done.length > 0 ? (
                <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {done.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      editing={editingId === item.id}
                      arriving={arrivingId === item.id}
                      {...rowProps}
                    />
                  ))}
                </ul>
              ) : (
                <p className="px-1 text-sm text-muted">
                  Checked-off items land here, with when they were checked off. Swipe right on an item to check it off, or left to delete it.
                </p>
              )}
            </section>
          </>
        ) : null}

        {/* <footer className="mt-12 flex flex-col items-center gap-2 border-t border-line pt-6">
          {saved ? (
            <form action={logOut}>
              <button
                type="submit"
                className="h-11 rounded-lg px-4 text-sm font-medium text-muted underline underline-offset-4"
              >
                Log out this device
              </button>
            </form>
          ) : null}
          <p className="text-sm text-muted">
            Powered by{" "}
            <a
              href="https://www.robowebsolutions.com"
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-leaf decoration-2 underline-offset-4 hover:text-leaf"
            >
              Robo Web Solutions
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </p>
        </footer> */}
      </main>

      <footer className="mt-12 border-t border-line px-4 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-6 text-center">
        <p className="text-sm text-muted">
          Powered by{" "}
          <a
            href="https://www.robowebsolutions.com"
            target="_blank"
            rel="noopener"
            className="inline-flex min-h-11 items-center font-semibold text-ink underline decoration-leaf decoration-2 underline-offset-4 hover:text-leaf"
          >
            Robo Web Solutions
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      </footer>

      {saveMode ? (
        <SaveDialog
          mode={saveMode}
          onModeChange={setSaveMode}
          onClose={() => setSaveMode(null)}
          getDeviceItems={() => itemsRef.current}
          onSaved={() => {
            handedOff.current = true;
          }}
        />
      ) : null}
    </div>
  );
}
