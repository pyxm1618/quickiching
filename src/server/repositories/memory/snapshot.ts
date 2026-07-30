function freezeSnapshot(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) freezeSnapshot(item, seen);
  } else if (!(value instanceof Date)) {
    for (const item of Object.values(value)) freezeSnapshot(item, seen);
  }
  Object.freeze(value);
}

export function cloneForStorage<T>(value: T): T {
  return structuredClone(value);
}

export function snapshot<T>(value: T): T {
  const copy = cloneForStorage(value);
  freezeSnapshot(copy, new WeakSet());
  return copy;
}
