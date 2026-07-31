import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function purgeDate(value: string | string[] | undefined): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export default async function AccountDeletedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const purgeAfter = purgeDate(params.purgeAfter);

  return (
    <main className="mx-auto max-w-2xl px-4 py-20">
      <Card>
        <CardContent className="space-y-5 pt-8">
          <h1 className="font-display text-3xl font-medium">Account deletion requested</h1>
          <p className="text-sm text-[var(--ink-2)]">
            Authentication sessions and provider credentials have been removed. Your account can no longer be used to access the application.
          </p>
          <p className="text-sm text-[var(--ink-2)]">
            Casting, question, preview, and reading content is hidden now and scheduled for physical deletion
            {purgeAfter ? ` on ${purgeAfter.toLocaleDateString("en-US")}` : " after the 30-day content retention window"}.
          </p>
          <p className="text-sm text-[var(--ink-2)]">
            Orders, refunds, disputes, and immutable entitlement records remain only in pseudonymous form where required for financial, fraud-prevention, and legal obligations.
          </p>
          <Link href="/">
            <Button type="button" variant="outline">Return home</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
