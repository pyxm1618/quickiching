import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { SealMark } from "@/components/hex/seal-mark";

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-display text-[17px] font-medium text-[var(--ink)]"
        >
          <SealMark size="sm" />
          <span>Quick I Ching</span>
        </Link>
        <nav className="hidden items-center gap-7 text-[13.5px] md:flex">
          <Link href="/i-ching-coin" className="text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]">
            Coin Reading
          </Link>
          <Link href="/casting-methods" className="text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]">
            Methods
          </Link>
          <Link href="/pricing" className="text-[var(--ink-2)] transition-colors hover:text-[var(--ink)]">
            Pricing
          </Link>
        </nav>
        <div className="flex items-center gap-3 text-[13.5px]">
          {user ? (
            <Link href="/account" className="font-medium text-[var(--jade)] hover:underline">
              {user.email}
            </Link>
          ) : (
            <Link href="/signin" className="font-medium text-[var(--jade)] hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
