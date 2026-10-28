"use client";

import { useEffect, useId, useRef, useState } from "react";
import { iconFor } from "@/lib/item-icons";
import { formatAbsolute, formatRelative } from "@/lib/relative-time";
import { LIMITS, type Item } from "@/lib/types";
import { CheckIcon, PencilIcon, TrashIcon, UndoIcon } from "./icons";

/** Time for the check + strikethrough to play before the row moves sections. */
const LEAVE_MS = 460;
const SWIPE_START_PX = 10;

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const haptic = (ms = 12) => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
};

type Props = {
  item: Item;
  now: number;
  editing: boolean;
  onToggle: (item: Item) => void;
  onStartEdit: (id: string) => void;
  onStopEdit: () => void;
  onSave: (input: { id: string; name: string; quantity: string | null; notes: string | null }) => void;
  onDelete: (item: Item) => void;
  onSwipeDelete: (item: Item) => void;
  /** Briefly highlight this row because it just moved here. */
  arriving: boolean;
};

export function ItemRow(props: Props) {
  return props.editing ? <EditRow {...props} /> : <ViewRow {...props} />;
}

function ViewRow({ item, now, onToggle, onStartEdit, onSwipeDelete, arriving }: Props) {
  const done = item.completed;
  const [leaving, setLeaving] = useState(false);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [removing, setRemoving] = useState(false);
  const drag = useRef<{ x: number; y: number; id: number; swiping: boolean; width: number } | null>(null);
  const zone = useRef<-1 | 0 | 1>(0);
  const suppressClick = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // While leaving, show the state the item is moving to.
  const shownDone = leaving ? !done : done;
  const icon = iconFor(item.name);

  function toggle() {
    if (leaving) return;
    haptic();
    if (reduceMotion()) {
      onToggle(item);
      return;
    }
    setLeaving(true);
    timers.current.push(setTimeout(() => onToggle(item), LEAVE_MS));
  }

  const threshold = () => Math.min(110, (drag.current?.width ?? 300) * 0.32);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (leaving || removing || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId, swiping: false, width: e.currentTarget.offsetWidth };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.swiping) {
      if (Math.abs(mx) < SWIPE_START_PX) return;
      if (Math.abs(my) > Math.abs(mx)) {
        drag.current = null; // vertical: let the page scroll
        return;
      }
      d.swiping = true;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    setDx(mx);
    const t = threshold();
    const next = mx > t ? 1 : mx < -t ? -1 : 0;
    if (next !== zone.current) {
      zone.current = next;
      if (next !== 0) haptic(8);
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.id !== e.pointerId || !d.swiping) return;
    setDragging(false);
    suppressClick.current = true; // the click that follows a swipe shouldn't toggle the checkbox
    timers.current.push(setTimeout(() => (suppressClick.current = false), 0));

    const action = cancelled ? 0 : zone.current;
    zone.current = 0;
    if (action === 1) {
      setDx(0);
      toggle();
    } else if (action === -1) {
      setRemoving(true);
      setDx(-d.width);
      timers.current.push(setTimeout(() => onSwipeDelete(item), reduceMotion() ? 0 : 200));
    } else {
      setDx(0);
    }
  }

  const swipeLabel = dx > 0 ? (done ? "Back to list" : "In the cart") : "Delete";
  const pastThreshold = Math.abs(dx) > threshold();

  return (
    <li className={`row-collapse border-b border-line last:border-b-0 ${leaving || removing ? "row-leave" : ""}`}>
      <div className="relative min-h-0 overflow-hidden">
        {/* Revealed behind the row while swiping */}
        {dx !== 0 ? (
          <div
            aria-hidden
            className={`absolute inset-0 flex items-center px-5 font-semibold ${
              dx > 0 ? "justify-start bg-leaf text-leaf-ink" : "justify-end bg-danger text-surface"
            }`}
          >
            <span
              className={`flex items-center gap-2 transition-transform duration-150 ${
                pastThreshold ? "scale-110" : "scale-90 opacity-70"
              }`}
            >
              {dx > 0 ? done ? <UndoIcon className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" /> : null}
              {swipeLabel}
              {dx < 0 ? <TrashIcon className="h-5 w-5" /> : null}
            </span>
          </div>
        ) : null}

        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endDrag(e, false)}
          onPointerCancel={(e) => endDrag(e, true)}
          onClickCapture={(e) => {
            if (suppressClick.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          style={{
            transform: dx ? `translateX(${dx}px)` : undefined,
            transition: dragging ? "none" : "transform 200ms ease-out",
          }}
          className={`relative flex touch-pan-y items-start gap-1 bg-surface p-1 ${dragging ? "select-none" : ""} ${
            arriving ? "row-arrive" : ""
          }`}
        >
          <label className="relative grid h-12 w-12 shrink-0 cursor-pointer place-items-center">
            <input
              type="checkbox"
              checked={shownDone}
              onChange={toggle}
              aria-label={done ? `Move ${item.name} back to the list` : `Mark ${item.name} as in the cart`}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`grid h-7 w-7 place-items-center rounded-full border-2 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-leaf ${
                shownDone ? "border-leaf bg-leaf text-leaf-ink" : "border-muted/60 bg-surface"
              } ${leaving && shownDone ? "check-pop" : ""}`}
            >
              {shownDone ? <CheckIcon className={leaving || !done ? "check-draw h-4 w-4" : "h-4 w-4"} /> : null}
            </span>
          </label>

          <div className={`min-w-0 flex-1 py-2.5 transition-opacity duration-300 ${shownDone ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="font-display text-lg font-semibold leading-snug">
                {icon ? (
                  <span aria-hidden className="mr-1.5 inline-block w-[1.3em] text-center not-italic">
                    {icon}
                  </span>
                ) : null}
                <span
                  className={`strike break-words decoration-2 ${shownDone ? "text-muted" : ""}`}
                  data-struck={shownDone}
                >
                  {item.name}
                </span>
              </span>
              {item.quantity ? (
                <span className="inline-block -rotate-2 rounded-md bg-tag px-2 py-0.5 text-sm font-bold text-tag-ink">
                  {item.quantity}
                </span>
              ) : null}
            </div>
            {item.notes ? (
              <p className="mt-0.5 whitespace-pre-line break-words text-sm text-muted">{item.notes}</p>
            ) : null}
            {done && item.completedAt ? (
              <time
                dateTime={item.completedAt}
                title={formatAbsolute(item.completedAt)}
                suppressHydrationWarning
                className="mt-0.5 block text-sm text-muted"
              >
                Checked off {formatRelative(item.completedAt, now)}
              </time>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => onStartEdit(item.id)}
            aria-label={`Edit ${item.name}`}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-muted"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </li>
  );
}

function EditRow({ item, onStopEdit, onSave, onDelete }: Props) {
  // Draft is seeded once, so background polling never overwrites what's being typed.
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = useId();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Item name is required");
      return;
    }
    onSave({ id: item.id, name: trimmed, quantity: quantity.trim() || null, notes: notes.trim() || null });
    onStopEdit();
  }

  const field =
    "w-full rounded-xl border border-line bg-paper px-3 text-base text-ink placeholder:text-muted";

  return (
    <li className="border-b border-line p-3 last:border-b-0">
      <form
        onSubmit={save}
        onKeyDown={(e) => {
          if (e.key === "Escape") onStopEdit();
        }}
        aria-label={`Edit ${item.name}`}
        className="space-y-2"
      >
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor={`${ids}-name`} className="mb-1 block text-sm font-medium text-muted">
              Item
            </label>
            <input
              id={`${ids}-name`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={LIMITS.name}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? `${ids}-error` : undefined}
              className={`${field} h-12`}
            />
          </div>
          <div className="w-24">
            <label htmlFor={`${ids}-qty`} className="mb-1 block text-sm font-medium text-muted">
              Qty
            </label>
            <input
              id={`${ids}-qty`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              maxLength={LIMITS.quantity}
              className={`${field} h-12 text-center`}
            />
          </div>
        </div>
        {error ? (
          <p id={`${ids}-error`} role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div>
          <label htmlFor={`${ids}-notes`} className="mb-1 block text-sm font-medium text-muted">
            Notes
          </label>
          <textarea
            id={`${ids}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={LIMITS.notes}
            rows={2}
            className={`${field} resize-none py-2`}
          />
        </div>

        {confirmDelete ? (
          <div className="flex items-center gap-2 rounded-xl border border-danger/40 p-2" role="group" aria-label="Confirm delete">
            <p className="flex-1 pl-1 text-sm font-medium">Delete {item.name}?</p>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="h-11 rounded-lg px-3 font-medium"
            >
              Keep
            </button>
            <button
              type="button"
              autoFocus
              onClick={() => {
                onDelete(item);
                onStopEdit();
              }}
              className="h-11 rounded-lg bg-danger px-4 font-semibold text-surface"
            >
              Delete
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-11 rounded-lg px-2 font-medium text-danger"
            >
              Delete
            </button>
            <span className="flex-1" />
            <button type="button" onClick={onStopEdit} className="h-11 rounded-lg px-4 font-medium">
              Cancel
            </button>
            <button type="submit" className="h-11 rounded-lg bg-leaf px-5 font-semibold text-leaf-ink">
              Save
            </button>
          </div>
        )}
      </form>
    </li>
  );
}
