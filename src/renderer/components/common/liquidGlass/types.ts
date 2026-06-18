export interface VGlassProps {
  as?: string
  blur?: number
  scale?: number
  baseFrequency?: number
  xChannelSelector?: 'R' | 'G' | 'B' | 'A'
  yChannelSelector?: 'R' | 'G' | 'B' | 'A'
  numOctaves?: number
  disableDistortion?: boolean
}

export interface LiquidGlassSegmentedNavItem {
  label: string
  value: string | number
  disabled?: boolean
}
