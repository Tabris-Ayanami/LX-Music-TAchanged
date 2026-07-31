// These ids map one-to-one to the vendored Folia visualizers. Keeping the
// catalogue shared makes the settings page, immersive dialog and React bridge
// stay in sync.
export const IMMERSIVE_EFFECT_IDS = [
  'classic',
  'cadenza',
  'partita',
  'fume',
  'cappella',
  'tilt',
  'claddagh',
  'diorama',
  'monet',
  'pendolo',
]

export const getImmersiveEffectOptions = t => IMMERSIVE_EFFECT_IDS.map(id => ({
  id,
  name: t(`setting__play_detail_immersive_effect_${id}`),
  description: t(`setting__play_detail_immersive_effect_${id}_desc`),
}))
