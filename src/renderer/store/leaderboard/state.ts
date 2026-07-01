import { reactive, markRaw, shallowReactive } from '@common/utils/vueTools'
import { leaderboardSources } from '@renderer/utils/musicSdk/staticMeta'

export type Source = LX.OnlineSource

export const sources: LX.OnlineSource[] = markRaw([...leaderboardSources])

export interface BoardItem {
  id: string
  name: string
  bangid: string
}
export interface Board {
  list: BoardItem[]
  source: LX.OnlineSource
}
type Boards = Partial<Record<LX.OnlineSource, Board>>

export const boards = shallowReactive<Boards>({})

export interface ListDetailInfo {
  list: LX.Music.MusicInfoOnline[]
  total: number
  page: number
  source: LX.OnlineSource | null
  limit: number
  key: string | null
  id: string
  noItemLabel: string
}

export const listDetailInfo = reactive<ListDetailInfo>({
  list: [],
  total: 0,
  page: 1,
  limit: 30,
  key: null,
  source: null,
  id: '',
  noItemLabel: '',
})
