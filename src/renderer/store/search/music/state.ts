import { reactive, markRaw } from '@common/utils/vueTools'

// import { deduplicationList } from '@common/utils/renderer'

const SEARCH_MUSIC_SOURCES: LX.OnlineSource[] = ['kw', 'kg', 'tx', 'wy', 'mg', 'bili']

export declare interface ListInfo {
  list: LX.Music.MusicInfo[]
  total: number
  page: number
  maxPage: number
  limit: number
  key: string | null
  noItemLabel: string
}

interface ListInfos extends Partial<Record<LX.OnlineSource, ListInfo>> {
  'all': ListInfo
}

export const sources: Array<LX.OnlineSource | 'all'> = markRaw([])

export const listInfos: ListInfos = markRaw({
  all: reactive<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: null,
    noItemLabel: '',
  }),
})
export const maxPages: Partial<Record<LX.OnlineSource, number>> = {}
for (const source of SEARCH_MUSIC_SOURCES) {
  sources.push(source)
  listInfos[source] = reactive<ListInfo>({
    page: 1,
    maxPage: 0,
    limit: 30,
    total: 0,
    list: [],
    key: '',
    noItemLabel: '',
  })
  maxPages[source] = 0
}
sources.push('all')
