"use client";

import { useId, useRef, useState } from "react";
import { LIMITS } from "@/lib/types";
import { PlusIcon } from "./icons";

type Props = {
  onAdd: (input: { name: string; quantity: string | null; notes: string | null }) => void;
};

export function AddItemForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      nameRef.current?.focus();
      return;
    }
    onAdd({ name: trimmed, quantity: quantity.trim() || null, notes: notes.trim() || null });
    setName("");
    setQuantity("");
    setNotes("");
    setShowNotes(false);
    nameRef.current?.focus();
  }

  return (
    <form onSubmit={submit} aria-label="Add an item">
      <div className="flex gap-2">
        <label htmlFor={`${ids}-name`} className="sr-only">
          Item name
        </label>
        <input
          ref={nameRef}
          id={`${ids}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={LIMITS.name}
          placeholder="Add an item"
          autoComplete="off"
          enterKeyHint="done"
          className="h-14 min-w-0 flex-1 rounded-xl border border-line bg-surface px-4 text-lg text-ink placeholder:text-muted"
        />
        <label htmlFor={`${ids}-qty`} className="sr-only">
          Quantity (optional)
        </label>
        <input
          id={`${ids}-qty`}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          maxLength={LIMITS.quantity}
          placeholder="Qty"
          autoComplete="off"
          className="h-14 w-20 rounded-xl border border-line bg-surface px-3 text-center text-lg text-ink placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label="Add item"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-leaf text-leaf-ink active:scale-95 motion-reduce:active:scale-100"
        >
          <PlusIcon className="h-7 w-7" />
        </button>
      </div>

      {showNotes ? (
        <div className="mt-2">
          <label htmlFor={`${ids}-notes`} className="sr-only">
            Notes (optional)
          </label>
          <textarea
            id={`${ids}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={LIMITS.notes}
            rows={2}
            autoFocus
            placeholder="Brand, size, which store…"
            className="w-full resize-none rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink placeholder:text-muted"
          />
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setShowNotes((s) => !s)}
        aria-expanded={showNotes}
        className="mt-1 h-10 rounded-lg px-1 text-sm font-medium text-muted"
      >
        {showNotes ? "Hide notes" : "+ Add notes"}
      </button>
    </form>
  );
}
