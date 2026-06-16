let idSeed = 0
export function generateFilterId(): string {
  idSeed += 1
  return `vglass-${Date.now().toString(36)}-${idSeed.toString(36)}`
}
