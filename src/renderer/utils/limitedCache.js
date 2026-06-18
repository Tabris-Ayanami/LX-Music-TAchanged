export const createLimitedCache = (limit = 100, ttl = 0) => {
  const map = new Map()

  const isExpired = entry => ttl > 0 && Date.now() - entry.time > ttl
  const getEntry = key => {
    const entry = map.get(key)
    if (!entry) return null
    if (isExpired(entry)) {
      map.delete(key)
      return null
    }
    map.delete(key)
    map.set(key, entry)
    return entry
  }
  const trim = () => {
    while (map.size > limit) map.delete(map.keys().next().value)
  }

  return {
    get size() {
      return map.size
    },
    has(key) {
      return getEntry(key) != null
    },
    get(key) {
      return getEntry(key)?.value
    },
    set(key, value) {
      if (map.has(key)) map.delete(key)
      map.set(key, {
        value,
        time: Date.now(),
      })
      trim()
      return this
    },
    delete(key) {
      return map.delete(key)
    },
    clear() {
      map.clear()
    },
    keys() {
      return map.keys()
    },
  }
}

export const setLimitedCache = (map, key, value, limit = 100) => {
  if (map.has(key)) map.delete(key)
  while (map.size >= limit) map.delete(map.keys().next().value)
  map.set(key, value)
}
