import { toRaw } from '@common/utils/vueTools'

export const toSerializableMusicInfo = <T extends LX.Music.MusicInfo>(musicInfo: T): T => {
  return JSON.parse(JSON.stringify(toRaw(musicInfo))) as T
}

export const toSerializableMusicInfos = <T extends LX.Music.MusicInfo>(musicInfos: T[]): T[] => {
  return musicInfos.map(musicInfo => toSerializableMusicInfo(musicInfo))
}
