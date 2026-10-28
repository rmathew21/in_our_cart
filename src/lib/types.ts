/** Item shape sent to the client. Dates are ISO strings so they serialize cleanly. */
export type Item = {
  id: string;
  name: string;
  quantity: string | null;
  notes: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; unauthorized?: boolean };

export const LIMITS = {
  name: 200,
  quantity: 50,
  notes: 500,
} as const;
