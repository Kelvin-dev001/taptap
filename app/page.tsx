import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Hornbill TapTap</h1>
      <p className="text-lg text-neutral-600">
        One smart link for your business — tap or scan to connect. Digital cards,
        review links, and engagement tools on a single platform.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-neutral-900 px-5 py-2.5 font-medium text-white hover:bg-neutral-700"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-5 py-2.5 font-medium hover:bg-neutral-50"
        >
          Dashboard
        </Link>
      </div>
    </main>
  );
}
