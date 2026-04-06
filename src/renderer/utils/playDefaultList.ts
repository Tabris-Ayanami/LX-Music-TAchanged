import { defaultList } from '@renderer/store/list/state'
import { addListMusics, getListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { toSerializableMusicInfos } from './musicInfo'

const clampPlayIndex = (index: number, length: number) => {
  if (!length) return 0
  if (index < 0) return 0
  if (index >= length) return length - 1
  return index
}

const normalizeMusicInfos = (musicInfos: LX.Music.MusicInfo[]) => {
  return toSerializableMusicInfos(musicInfos).filter(musicInfo => !!musicInfo?.id && !!musicInfo.name)
}

export const appendToDefaultList = async(musicInfos: LX.Music.MusicInfo[]) => {
  const normalizedList = normalizeMusicInfos(musicInfos)
  if (!normalizedList.length) return []
  await addListMusics(defaultList.id, normalizedList, 'bottom')
  return getListMusics(defaultList.id)
}

export const playMusicsInDefaultList = async(musicInfos: LX.Music.MusicInfo[], index: number = 0) => {
  const normalizedList = normalizeMusicInfos(musicInfos)
  if (!normalizedList.length) return -1

  const safeIndex = clampPlayIndex(index, normalizedList.length)
  const targetMusic = normalizedList[safeIndex]
  const currentList = await getListMusics(defaultList.id)
  let targetIndex = currentList.findIndex(musicInfo => musicInfo.id == targetMusic.id)

  await addListMusics(defaultList.id, normalizedList, 'bottom')

  const updatedList = await getListMusics(defaultList.id)
  if (targetIndex < 0) {
    targetIndex = updatedList.findIndex(musicInfo => musicInfo.id == targetMusic.id)
  }
  if (targetIndex < 0) {
    targetIndex = clampPlayIndex(updatedList.length - normalizedList.length + safeIndex, updatedList.length)
  }

  playList(defaultList.id, targetIndex)
  return targetIndex
}

export const playMusicInDefaultList = async(musicInfo: LX.Music.MusicInfo) => {
  return playMusicsInDefaultList([musicInfo], 0)
}
