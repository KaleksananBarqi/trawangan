/**
 * Kloning mendalam yang aman untuk objek Proxy Svelte 5 ($state) dan referensi siklik.
 */
export function safeClone<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value as object)) {
    return seen.get(value as object) as T;
  }

  if (value instanceof Date) {
    return new Date(value.getTime()) as unknown as T;
  }

  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as unknown as T;
  }

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    seen.set(value, out);
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      out.push(typeof item === 'function' ? undefined : safeClone(item, seen));
    }
    return out as unknown as T;
  }

  if (value instanceof Set) {
    const out = new Set<unknown>();
    seen.set(value, out);
    for (const item of value) {
      out.add(safeClone(item, seen));
    }
    return out as unknown as T;
  }

  if (value instanceof Map) {
    const out = new Map<unknown, unknown>();
    seen.set(value, out);
    for (const [k, v] of value.entries()) {
      out.set(safeClone(k, seen), safeClone(v, seen));
    }
    return out as unknown as T;
  }

  const out: Record<string, unknown> = {};
  seen.set(value as object, out);
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const prop = (value as Record<string, unknown>)[key];
    if (typeof prop === 'function') continue;
    out[key] = safeClone(prop, seen);
  }
  return out as T;
}
