import { getCurrentUser } from "@/lib/auth/session";

/** Linked sign-in methods, not the provider of a particular session (not stored by Better Auth). */
export async function loadSignInMethods(
  resolvedUser?: { id: string; email: string } | null,
): Promise<string[]> {
  const user = resolvedUser === undefined ? await getCurrentUser() : resolvedUser;
  if (!user) return [];
  if (process.env.DATABASE_ADAPTER_MODE !== "postgres" || !process.env.DATABASE_URL) return [];
  const { getPostgresClient } = await import("@/server/db/client");
  const rows = await getPostgresClient()<Array<{ provider_id: string | null; email_verified: boolean }>>`
    select a.provider_id, u.email_verified
    from users u left join accounts a on a.user_id = u.id
    where u.id = ${user.id}
    order by a.provider_id
  `;
  const methods = rows.flatMap((row) => {
    if (row.provider_id === "google") return ["Google"];
    if (row.provider_id === "email" || row.provider_id === "magic-link") return ["Email (Magic Link)"];
    if (row.provider_id) return [row.provider_id];
    // Better Auth's magic-link plugin creates a verified user and session,
    // without an accounts row. Google users always have a linked account row.
    return row.email_verified ? ["Email (Magic Link)"] : [];
  });
  return [...new Set(methods)];
}
