"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">The list couldn&apos;t load</h1>
      <p className="mt-2 text-muted">Check your connection, then try again.</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 h-12 rounded-xl bg-leaf px-6 font-semibold text-leaf-ink"
      >
        Try again
      </button>
    </main>
  );
}
