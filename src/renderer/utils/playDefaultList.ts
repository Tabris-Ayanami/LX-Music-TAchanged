import { defaultList } from '@renderer/store/list/state'
import { addListMusics, getListMusics, overwriteListMusics } from '@renderer/store/list/action'
import { playList } from '@renderer/core/player'
import { playInfo, playMusicInfo } from '@renderer/store/player/state'
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

const dedupeMusicInfos = (musicInfos: LX.Music.MusicInfo[]) => {
  const ids = new Set<string>()
  return musicInfos.filter(musicInfo => {
    if (ids.has(musicInfo.id)) return false
    ids.add(musicInfo.id)
    return true
  })
}

const getCurrentMusicId = () => {
  const currentMusicInfo = playMusicInfo.musicInfo
  if (!currentMusicInfo) return null
  return 'progress' in currentMusicInfo
    ? currentMusicInfo.metadata.musicInfo.id
    : currentMusicInfo.id
}

const getCurrentDefaultListIndex = (currentList: LX.Music.MusicInfo[]) => {
  const currentMusicId = getCurrentMusicId()
  const currentIndex = currentMusicId
    ? currentList.findIndex(musicInfo => musicInfo.id == currentMusicId)
    : -1
  if (currentIndex > -1) return currentIndex
  if (playMusicInfo.listId == defaultList.id && playInfo.playerPlayIndex > -1 && playInfo.playerPlayIndex < currentList.length) {
    return playInfo.playerPlayIndex
  }
  return -1
}

export const appendToDefaultList = async(musicInfos: LX.Music.MusicInfo[]) => {
  const normalizedList = normalizeMusicInfos(musicInfos)
  if (!normalizedList.length) return []
  await addListMusics(defaultList.id, normalizedList, 'bottom')
  return getListMusics(defaultList.id)
}

export const queueNextInDefaultList = async(musicInfos: LX.Music.MusicInfo[]) => {
  const normalizedList = normalizeMusicInfos(musicInfos)
  if (!normalizedList.length) return []
  if (!playMusicInfo.musicInfo) {
    await playMusicsInDefaultList(normalizedList, 0)
    return getListMusics(defaultList.id)
  }

  const currentList = await getListMusics(defaultList.id)
  const currentMusicId = getCurrentMusicId()
  const currentIndex = getCurrentDefaultListIndex(currentList)
  if (currentIndex < 0) {
    await addListMusics(defaultList.id, normalizedList, 'bottom')
    return getListMusics(defaultList.id)
  }

  const insertIds = new Set<string>()
  const insertList = normalizedList.filter(musicInfo => {
    if (musicInfo.id == currentMusicId || insertIds.has(musicInfo.id)) return false
    insertIds.add(musicInfo.id)
    return true
  })
  if (!insertList.length) return currentList

  const nextList = dedupeMusicInfos([
    ...currentList.slice(0, currentIndex + 1),
    ...insertList,
    ...currentList.slice(currentIndex + 1).filter(musicInfo => !insertIds.has(musicInfo.id)),
  ])
  await overwriteListMusics({
    listId: defaultList.id,
    musicInfos: nextList,
  })
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
