import React, {
  Component,
  Suspense,
  lazy,
  useEffect,
  useMemo,
} from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { createInstance } from 'i18next'
import { useMotionValue } from 'framer-motion'
import { getAnalyser, getAudioContext, getCurrentTime, setCurrentTime } from '@renderer/plugins/player'
import type {
  AudioBands,
  Line,
  Theme,
} from '../../../vendor/folia/types'
import {
  DEFAULT_CADENZA_TUNING,
  DEFAULT_CAPPELLA_TUNING,
  DEFAULT_CLASSIC_TUNING,
  DEFAULT_CLADDAGH_TUNING,
  DEFAULT_DIORAMA_TUNING,
  DEFAULT_FUME_TUNING,
  DEFAULT_MONET_TUNING,
  DEFAULT_PARTITA_TUNING,
  DEFAULT_PENDOLO_TUNING,
  DEFAULT_TILT_TUNING,
} from '../../../vendor/folia/types'
import type { VisualizerSharedProps } from '../../../vendor/folia/components/visualizer/definition'
import './folia-tailwind.css'

export type FoliaEffect =
  | 'classic'
  | 'cadenza'
  | 'partita'
  | 'fume'
  | 'cappella'
  | 'tilt'
  | 'claddagh'
  | 'diorama'
  | 'monet'
  | 'pendolo'

export interface FoliaVisualizerProps {
  effect: FoliaEffect
  lines: Line[]
  currentLineIndex: number
  playing: boolean
  coverUrl?: string | null
  songTitle?: string | null
  songArtist?: string | null
  songAlbum?: string | null
  seed?: string | number
  theme: Theme
}

const i18n = createInstance()
void i18n.init({
  lng: 'zh-CN',
  fallbackLng: 'zh-CN',
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  resources: {
    'zh-CN': {
      translation: {
        ui: {
          waitingForMusic: '等待歌词',
          unknownSong: '未知歌曲',
          unknownArtist: '未知歌手',
        },
      },
    },
  },
})

const visualizers = {
  classic: lazy(async() => import('../../../vendor/folia/components/visualizer/classic/Visualizer')),
  cadenza: lazy(async() => import('../../../vendor/folia/components/visualizer/cadenza/VisualizerCadenza')),
  partita: lazy(async() => import('../../../vendor/folia/components/visualizer/partita/VisualizerPartita')),
  fume: lazy(async() => import('../../../vendor/folia/components/visualizer/fume/VisualizerFume')),
  cappella: lazy(async() => import('../../../vendor/folia/components/visualizer/cappella/VisualizerCappella')),
  tilt: lazy(async() => import('../../../vendor/folia/components/visualizer/tilt/VisualizerTilt')),
  claddagh: lazy(async() => import('../../../vendor/folia/components/visualizer/claddagh/VisualizerCladdagh')),
  diorama: lazy(async() => import('../../../vendor/folia/components/visualizer/diorama/VisualizerDiorama')),
  monet: lazy(async() => import('../../../vendor/folia/components/visualizer/monet/VisualizerMonet')),
  pendolo: lazy(async() => import('../../../vendor/folia/components/visualizer/pendolo/VisualizerPendolo')),
} satisfies Record<FoliaEffect, React.LazyExoticComponent<React.ComponentType<VisualizerSharedProps>>>

interface ErrorBoundaryState {
  failed: boolean
}

interface ErrorBoundaryProps extends React.PropsWithChildren {
  fallback: React.ReactNode
}

class FoliaErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('[Folia] visualizer render failed', error)
  }

  render() {
    if (this.state.failed) return this.props.fallback
    return this.props.children
  }
}

const average = (values: Uint8Array, start: number, end: number) => {
  const safeStart = Math.max(0, Math.min(values.length - 1, Math.floor(start)))
  const safeEnd = Math.max(safeStart + 1, Math.min(values.length, Math.ceil(end)))
  let total = 0
  for (let index = safeStart; index < safeEnd; index++) total += values[index]
  return total / (safeEnd - safeStart)
}

const FoliaFallback = ({ line, theme }: { line?: Line, theme: Theme }) => (
  <div
    className="absolute inset-0 flex items-center justify-center px-12 text-center"
    style={{
      color: theme.primaryColor,
      fontFamily: theme.fontFamily,
      fontSize: 'clamp(2rem, 5vw, 5rem)',
      fontWeight: 700,
      textShadow: `0 0 28px ${theme.accentColor}`,
    }}
  >
    {line?.fullText ?? '等待歌词'}
  </div>
)

const FoliaVisualizer = (props: FoliaVisualizerProps) => {
  const currentTime = useMotionValue(getCurrentTime())
  const audioPower = useMotionValue(0)
  const bass = useMotionValue(0)
  const lowMid = useMotionValue(0)
  const mid = useMotionValue(0)
  const vocal = useMotionValue(0)
  const treble = useMotionValue(0)
  const spectrum = useMotionValue(new Uint8Array(0))
  const audioBands = useMemo<AudioBands>(() => ({
    bass,
    lowMid,
    mid,
    vocal,
    treble,
    spectrum,
  }), [bass, lowMid, mid, spectrum, treble, vocal])

  useEffect(() => {
    let frameId = 0
    let frequencyData = new Uint8Array(0)
    let spectrumFrame = 0

    const renderFrame = () => {
      currentTime.set(getCurrentTime())
      const analyser = getAnalyser()
      if (analyser) {
        if (frequencyData.length !== analyser.frequencyBinCount) {
          frequencyData = new Uint8Array(analyser.frequencyBinCount)
        }
        analyser.getByteFrequencyData(frequencyData)
        const audioContext = getAudioContext()
        const hzPerBin = (audioContext?.sampleRate ?? 44100) / analyser.fftSize
        const bin = (hz: number) => hz / hzPerBin
        bass.set(average(frequencyData, bin(20), bin(150)))
        lowMid.set(average(frequencyData, bin(150), bin(400)))
        mid.set(average(frequencyData, bin(400), bin(1200)))
        vocal.set(average(frequencyData, bin(1000), bin(3500)))
        treble.set(average(frequencyData, bin(3500), bin(12000)))
        audioPower.set(average(frequencyData, bin(20), bin(12000)))
        // Spectrum consumers do not need a fresh allocation at display refresh
        // rate. Updating at ~20 fps keeps the visual fluid and reduces GC churn.
        if (++spectrumFrame % 3 === 0) spectrum.set(frequencyData.slice())
      }
      if (props.playing) frameId = window.requestAnimationFrame(renderFrame)
    }

    renderFrame()
    return () => window.cancelAnimationFrame(frameId)
  }, [audioPower, bass, currentTime, lowMid, mid, props.playing, spectrum, treble, vocal])

  const Visualizer = visualizers[props.effect] ?? visualizers.classic
  const sharedProps: VisualizerSharedProps = {
    currentTime,
    currentLineIndex: props.currentLineIndex,
    lines: props.lines,
    theme: props.theme,
    subtitleTheme: props.theme,
    audioPower,
    audioBands,
    showText: true,
    songTitle: props.songTitle,
    songArtist: props.songArtist,
    songAlbum: props.songAlbum,
    coverUrl: props.coverUrl,
    seed: props.seed,
    staticMode: false,
    backgroundStaticMode: false,
    visualizerOpacity: 1,
    lyricsFontScale: 1,
    subtitleFontScale: 1,
    subtitleOverlayOpacity: 0.72,
    subtitleOverlayBackground: false,
    showHarmonySubtitle: true,
    harmonySubtitleBackground: false,
    isPlayerChromeHidden: true,
    hideTranslationSubtitle: false,
    showSubtitleTranslation: true,
    subtitleContentMode: 'translation',
    paused: !props.playing,
    isPreviewMode: false,
    onLyricLineSeek: setCurrentTime,
    classicTuning: DEFAULT_CLASSIC_TUNING,
    cadenzaTuning: DEFAULT_CADENZA_TUNING,
    partitaTuning: DEFAULT_PARTITA_TUNING,
    fumeTuning: DEFAULT_FUME_TUNING,
    claddaghTuning: DEFAULT_CLADDAGH_TUNING,
    cappellaTuning: DEFAULT_CAPPELLA_TUNING,
    tiltTuning: DEFAULT_TILT_TUNING,
    dioramaTuning: DEFAULT_DIORAMA_TUNING,
    monetTuning: DEFAULT_MONET_TUNING,
    pendoloTuning: DEFAULT_PENDOLO_TUNING,
  }

  const fallback = <FoliaFallback line={props.lines[props.currentLineIndex]} theme={props.theme} />
  return (
    <I18nextProvider i18n={i18n}>
      <FoliaErrorBoundary key={props.effect} fallback={fallback}>
        <Suspense fallback={fallback}>
          <Visualizer {...sharedProps} />
        </Suspense>
      </FoliaErrorBoundary>
    </I18nextProvider>
  )
}

export interface FoliaRenderer {
  render: (props: FoliaVisualizerProps) => void
  unmount: () => void
}

export const createFoliaRenderer = (element: HTMLElement): FoliaRenderer => {
  const root: Root = createRoot(element)
  return {
    render(props) {
      root.render(<FoliaVisualizer {...props} />)
    },
    unmount() {
      root.unmount()
    },
  }
}
