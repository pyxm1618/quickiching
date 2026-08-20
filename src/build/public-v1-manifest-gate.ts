export type PublicV1ServerAction = {
  id: string;
  key: string;
  filename: string;
  exportedName: string;
};

export const PUBLIC_V1_SERVER_ACTION_ALLOWLIST: readonly string[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function collectServerActions(manifest: unknown): PublicV1ServerAction[] {
  if (!isRecord(manifest)) return [];

  const actions = new Map<string, PublicV1ServerAction>();
  for (const containerName of ["node", "edge"] as const) {
    const container = manifest[containerName];
    if (!isRecord(container)) continue;

    for (const [id, candidate] of Object.entries(container)) {
      if (!isRecord(candidate)) continue;
      const filename = typeof candidate.filename === "string" ? candidate.filename : null;
      const exportedName = typeof candidate.exportedName === "string" ? candidate.exportedName : null;
      if (!filename || !exportedName) continue;
      const key = `${filename}#${exportedName}`;
      actions.set(`${id}:${key}`, { id, key, filename, exportedName });
    }
  }

  return [...actions.values()];
}

export function assertPublicV1ServerActions(
  manifest: unknown,
  allowlist: readonly string[] = PUBLIC_V1_SERVER_ACTION_ALLOWLIST,
): void {
  const unapproved = collectServerActions(manifest).filter((action) => !allowlist.includes(action.key));
  if (unapproved.length === 0) return;

  const details = unapproved.map((action) => `${action.key} [${action.id}]`).join(", ");
  throw new Error(`PUBLIC_V1_SERVER_ACTIONS_FORBIDDEN: ${unapproved.length} unapproved action(s): ${details}`);
}
