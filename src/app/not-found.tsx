import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="text-2xl font-bold">This page doesn&apos;t exist</h1>
      <Link href="/" className="mt-4 font-medium text-leaf underline underline-offset-4">
        Go to your list
      </Link>
    </main>
  );
}
