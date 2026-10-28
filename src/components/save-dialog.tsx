"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createList, logIn } from "@/app/account-actions";
import { clearDeviceItems } from "@/lib/device-storage";
import type { Item } from "@/lib/types";

export type SaveMode = "signup" | "login";

type Props = {
  mode: SaveMode;
  onModeChange: (mode: SaveMode) => void;
  onClose: () => void;
  /** Read at submit time so the latest device items are sent. */
  getDeviceItems: () => Item[];
  /** Called once the device's items are safely on the server. */
  onSaved: () => void;
};

const itemsLabel = (n: number) => (n === 1 ? "1 item" : `${n} items`);

function randomPin(): string {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return String(n! % 10_000).padStart(4, "0");
}

export function SaveDialog({ mode, onModeChange, onClose, getDeviceItems, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const ids = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [created, setCreated] = useState<{ name: string; pin: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const count = getDeviceItems().length;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    setCanShare(typeof navigator.share === "function");
  }, []);

  // Suggest a PIN when creating a list; start blank when logging in.
  useEffect(() => {
    setError(null);
    setPin(mode === "signup" ? randomPin() : "");
  }, [mode]);

  function close() {
    if (created) return; // the details must be acknowledged first
    dialogRef.current?.close();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin)) {
      setError(mode === "signup" ? "Your PIN needs to be exactly 4 digits." : "Enter your 4-digit PIN.");
      return;
    }
    setPending(true);
    setError(null);
    const payload = { name, pin, deviceItems: getDeviceItems() };
    const res = await (mode === "signup" ? createList(payload) : logIn(payload)).catch(() => null);
    if (!res || !res.ok) {
      setPending(false);
      setError(res?.error ?? "Couldn't reach the server. Check your connection and try again.");
      return;
    }
    clearDeviceItems();
    onSaved();
    if (mode === "signup" && "name" in res.data) {
      setPending(false);
      setCreated({ name: res.data.name, pin });
    } else {
      router.refresh(); // server now renders the saved list for this device
    }
  }

  const shareText = created ? `Our list on In Our Cart (https://inourcart.net)\nList name: ${created.name}\nPIN: ${created.pin}` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
    } catch {
      setError("Couldn't copy. Write the name and PIN down instead.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "In Our Cart", text: shareText });
    } catch {
      // share sheet dismissed
    }
  }

  const button = "h-12 rounded-xl px-5 font-semibold disabled:opacity-60";
  const field = "h-14 w-full rounded-xl border border-line bg-paper px-4 text-lg text-ink placeholder:text-muted";
  const isSignup = mode === "signup";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${ids}-title`}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) close(); // tap on the backdrop
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-surface p-0 text-ink backdrop:bg-black/50"
    >
      <div className="p-6">
        {created ? (
          <>
            <h2 id={`${ids}-title`} className="font-display text-2xl font-bold">
              Your list is saved
            </h2>
            <p className="mt-2 text-muted">
              Use this name and PIN to open the list on another device. Share them with anyone who shops with you.
            </p>
            <dl className="mt-5 grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-2 rounded-xl bg-tag px-5 py-4 text-tag-ink">
              <dt className="text-sm font-medium">List name</dt>
              <dd className="break-words text-xl font-bold">{created.name}</dd>
              <dt className="text-sm font-medium">PIN</dt>
              <dd className="text-3xl font-bold tracking-[0.3em]">{created.pin}</dd>
            </dl>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copy} className={`${button} flex-1 border border-line`}>
                {copied ? "Copied" : "Copy"}
              </button>
              {canShare ? (
                <button type="button" onClick={share} className={`${button} flex-1 border border-line`}>
                  Share
                </button>
              ) : null}
            </div>
            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => router.refresh()}
              autoFocus
              className={`${button} mt-6 w-full bg-leaf text-leaf-ink`}
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <h2 id={`${ids}-title`} className="font-display text-2xl font-bold">
              {isSignup ? "Save your list" : "Open your list"}
            </h2>
            <p className="mt-2 text-muted">
              {isSignup
                ? "Pick a name for your list and a PIN. You'll use both to open it on other devices."
                : "Enter your list name and PIN."}
              {count > 0
                ? isSignup
                  ? ` The ${itemsLabel(count)} on this device will be saved to it.`
                  : ` The ${itemsLabel(count)} on this device will be added to that list.`
                : ""}
            </p>

            <label htmlFor={`${ids}-name`} className="mb-2 mt-5 block font-medium">
              List name
            </label>
            <input
              id={`${ids}-name`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={isSignup ? "e.g. Maple Street" : undefined}
              autoFocus
              autoComplete="username"
              autoCapitalize="words"
              autoCorrect="off"
              spellCheck={false}
              maxLength={40}
              className={field}
            />

            <label htmlFor={`${ids}-pin`} className="mb-2 mt-4 block font-medium">
              {isSignup ? "PIN (you can change it)" : "PIN"}
            </label>
            <input
              id={`${ids}-pin`}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setError(null);
              }}
              inputMode="numeric"
              autoComplete={isSignup ? "new-password" : "current-password"}
              pattern="\d{4}"
              maxLength={4}
              placeholder="0000"
              className={`${field} text-center text-2xl font-bold tracking-[0.5em]`}
            />

            {error ? (
              <p role="alert" className="mt-3 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex gap-2">
              <button type="button" onClick={close} className={`${button} border border-line`}>
                Cancel
              </button>
              <button type="submit" disabled={pending} className={`${button} flex-1 bg-leaf text-leaf-ink`}>
                {pending ? (isSignup ? "Saving…" : "Opening…") : isSignup ? "Save my list" : "Open my list"}
              </button>
            </div>

            <p className="mt-5 text-center text-sm text-muted">
              {isSignup ? "Already have a list? " : "New here? "}
              <button
                type="button"
                onClick={() => onModeChange(isSignup ? "login" : "signup")}
                className="font-semibold text-leaf underline underline-offset-4"
              >
                {isSignup ? "Log in" : "Create a list"}
              </button>
            </p>
          </form>
        )}
      </div>
    </dialog>
  );
}
