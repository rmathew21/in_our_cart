import type { Item } from "./types";

/** Items for people who haven't saved their list yet live in this browser only. */
const KEY = "shopping-list:device-items:v1";

export function loadDeviceItems(): Item[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Item[]) : [];
  } catch {
    return [];
  }
}

export function saveDeviceItems(items: Item[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Storage full or blocked (private browsing): the list still works for this visit.
  }
}

export function clearDeviceItems(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
