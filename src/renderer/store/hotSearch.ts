import { reactive, markRaw } from '@common/utils/vueTools'

// import { deduplicationList } from '@common/utils/renderer'

export type Source = LX.OnlineSource | 'all'
const HOT_SEARCH_SOURCES: LX.OnlineSource[] = ['kw', 'kg', 'tx', 'wy', 'mg']
const hotSearchLoaders: Partial<Record<LX.OnlineSource, () => Promise<any>>> = {
  kw: async() => import('@renderer/utils/musicSdk/kw/hotSearch').then(({ default: hotSearch }) => hotSearch),
  kg: async() => import('@renderer/utils/musicSdk/kg/hotSearch').then(({ default: hotSearch }) => hotSearch),
  tx: async() => import('@renderer/utils/musicSdk/tx/hotSearch').then(({ default: hotSearch }) => hotSearch),
  wy: async() => import('@renderer/utils/musicSdk/wy/hotSearch').then(({ default: hotSearch }) => hotSearch),
  mg: async() => import('@renderer/utils/musicSdk/mg/hotSearch').then(({ default: hotSearch }) => hotSearch),
}
const hotSearchApis: Partial<Record<LX.OnlineSource, Promise<any>>> = {}
const getHotSearchApi = async(source: LX.OnlineSource) => {
  const loader = hotSearchLoaders[source]
  if (!loader) return null
  hotSearchApis[source] ||= loader()
  return hotSearchApis[source]
}

interface SourceLists extends Partial<Record<LX.OnlineSource, string[]>> {
  'all': string[]
}

export const sources: Source[] = markRaw([])

export const sourceList: SourceLists = markRaw({
  all: reactive<string[]>([]),
})


for (const source of HOT_SEARCH_SOURCES) {
  sources.push(source)
  sourceList[source] = reactive<string[]>([])
}
sources.push('all')


const setList = (source: LX.OnlineSource, list: string[]): string[] => {
  return sourceList[source] = list.slice(0, 20)
}

const setLists = (lists: Array<{ source: LX.OnlineSource, list: string[] }>): string[] => {
  let wordsMap = new Map<string, number>()
  for (const { source, list } of lists) {
    if (!sourceList[source]?.length) sourceList[source] = list.slice(0, 20)
    for (let item of list) {
      item = item.trim()
      wordsMap.set(item, (wordsMap.get(item) ?? 0) + 1)
    }
  }
  const wordsMapArr = Array.from(wordsMap)
  wordsMapArr.sort((a, b) => a[0].localeCompare(b[0]))
  wordsMapArr.sort((a, b) => b[1] - a[1])
  const words = wordsMapArr.map(item => item[0])
  return sourceList.all = words.slice(0, sources.length * 10)
}

export const getList = async(source: Source): Promise<string[]> => {
  if (source == 'all') {
    let task = []
    for (const source of sources) {
      if (source == 'all') continue
      task.push(
        sourceList[source]?.length
          ? Promise.resolve({ source, list: sourceList[source] })
          : getHotSearchApi(source)
            .then(api => api?.getList() ?? Promise.reject(new Error('source not found: ' + source)))
            .then((data: { list: string[] }) => ({ source, list: data.list }))
            .catch((err: any) => {
              console.log(err)
              return { source, list: [] }
            }),
      )
    }
    return Promise.all(task).then((results: any[]) => {
      return setLists(results)
    })
  } else {
    if (sourceList[source]?.length) return Promise.resolve(sourceList[source])
    const api = await getHotSearchApi(source)
    if (!api) {
      setList(source, [])
      return Promise.resolve([])
    }
    return api.getList().then((data: { list: string[] }) => setList(source, data.list))
  }
}


export const clearList = (source: Source) => {
  sourceList[source] = []
}
