/**
 * Menyaring array agar setiap key yang diekstrak hanya muncul satu kali
 * dengan mempertahankan urutan kemunculan pertama.
 * Dipakai untuk mencegah `each_key_duplicate` pada blok `{#each}` Svelte.
 */
export function dedupeByKey<T, K = string>(items: readonly T[], getKey: (item: T) => K): T[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  if (items.length === 1) return [items[0]];

  const seen = new Set<K>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
