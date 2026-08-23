export const applyPlayerStatusPatch = (
  current: LX.Player.Status,
  patch: Partial<LX.Player.Status>,
): Partial<LX.Player.Status> | null => {
  let changed: Partial<LX.Player.Status> | null = null
  for (const [key, value] of Object.entries(patch)) {
    if (Object.is(current[key as keyof LX.Player.Status], value)) continue
    changed ??= {}
    // @ts-expect-error indexed assignment over the status patch keys
    current[key] = value
    // @ts-expect-error indexed assignment over the status patch keys
    changed[key] = value
  }
  return changed
}
