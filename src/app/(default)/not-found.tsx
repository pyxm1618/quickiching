import Link from "next/link";

export default function NotFound() {
  return (
    <section data-realm="chamber" className="mx-auto flex min-h-[62vh] w-full max-w-3xl items-center px-4 py-16 sm:px-6" aria-labelledby="not-found-title">
      <div className="w-full rounded-[2rem] border border-white/[0.1] bg-white/[0.045] px-6 py-10 text-center shadow-[0_30px_100px_rgba(0,0,0,.42)] backdrop-blur-xl sm:px-10 sm:py-14">
        <p className="mystic-kicker">404 · Path not found</p>
        <h1 id="not-found-title" className="mt-3 font-display text-4xl font-normal tracking-[-0.04em] text-white sm:text-5xl">Page Not Found</h1>
        <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[var(--ink-2)] sm:text-base">The page you requested does not exist. Return to Quick I Ching to begin a reading or explore the public guides.</p>
        <Link href="/" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full border border-[rgba(232,198,122,0.42)] bg-[rgba(232,198,122,0.08)] px-6 py-3 font-semibold text-[var(--gold-2)] transition hover:border-[rgba(232,198,122,0.72)] hover:bg-[rgba(232,198,122,0.12)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--cyan)] motion-reduce:transition-none">Return Home</Link>
      </div>
    </section>
  );
}
