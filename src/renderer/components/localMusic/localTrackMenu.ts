export type LocalTrackMenuAction = 'play' | 'playLater' | 'addTo' | 'editMetadata' | 'matchLyrics' | 'revealFile' | 'copyName' | 'remove'

export interface LocalTrackMenuItem {
  name: string
  action: LocalTrackMenuAction
}

export const buildLocalTrackMenuItems = ({
  hasLyrics,
  canRemoveFromList,
}: {
  hasLyrics: boolean
  canRemoveFromList: boolean
}): LocalTrackMenuItem[] => {
  const items: LocalTrackMenuItem[] = [
    { name: '播放', action: 'play' },
    { name: '下一首播放', action: 'playLater' },
    { name: '添加到歌单', action: 'addTo' },
    { name: '编辑歌曲信息', action: 'editMetadata' },
    { name: hasLyrics ? '重新匹配歌词' : '匹配歌词', action: 'matchLyrics' },
    { name: '在资源管理器中显示', action: 'revealFile' },
    { name: '复制“歌曲 - 歌手”', action: 'copyName' },
  ]
  if (canRemoveFromList) items.push({ name: '从当前歌单移除', action: 'remove' })
  return items
}
