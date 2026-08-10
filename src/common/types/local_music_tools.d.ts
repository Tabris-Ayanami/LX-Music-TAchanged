declare namespace LX {
  namespace LocalMusic {
    interface Metadata {
      filePath: string
      format: string
      title: string
      artists: string[]
      album: string
      albumArtists: string[]
      trackNumber: number
      totalTracks: number
      discNumber: number
      totalDiscs: number
      year: number
      genre: string[]
      comment: string
      composer: string[]
      coverDataUrl: string
      duration: number
      bitrate: number
      sampleRate: number
    }

    interface MetadataWriteRequest {
      filePath: string
      metadata: Omit<Metadata, 'filePath' | 'format' | 'bitrate' | 'sampleRate'>
      coverChanged: boolean
    }

    interface EmbeddedLyricsWriteRequest {
      filePath: string
      lyric: string
    }
  }
}
