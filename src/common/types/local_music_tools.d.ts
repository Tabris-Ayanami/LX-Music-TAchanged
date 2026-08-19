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
      coverSourcePath?: string
    }

    interface EmbeddedLyricsWriteRequest {
      filePath: string
      lyric: string
    }

    type ArtworkSize = 64 | 128 | 256 | 512

    interface ArtworkHandle {
      id: string
      url: string
      mimeType: string
      width: number
      height: number
      byteLength: number
      sourceFingerprint: string
    }

    interface ArtworkVariantRequest {
      filePath: string
      size: ArtworkSize
      externalArtworkPath?: string
    }

    interface ExternalArtworkRequest {
      mediaFilePath: string
      artworkFilePath: string
      size: ArtworkSize
    }
  }
}
