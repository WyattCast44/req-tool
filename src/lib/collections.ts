export interface Identifiable {
  id: string
}

export function indexById<T extends Identifiable>(items: readonly T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

export function groupBy<T, K>(
  items: readonly T[],
  getKey: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = getKey(item)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}
