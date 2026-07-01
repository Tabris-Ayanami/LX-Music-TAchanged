import { APP_EVENT_NAMES } from './constants'


const keyName = {
  common: APP_EVENT_NAMES.winMainName,
  player: APP_EVENT_NAMES.winMainName,
}

const hotKey = {
  common: {
    min: {
      name: 'min',
      action: 'min',
      type: '',
    },
    min_toggle: {
      name: 'toggle_min',
      action: 'toggle_min',
      type: '',
    },
    hide_toggle: {
      name: 'toggle_hide',
      action: 'toggle_hide',
      type: '',
    },
    close: {
      name: 'toggle_close',
      action: 'toggle_close',
      type: '',
    },
    focusSearchInput: {
      name: 'focus_search_input',
      action: 'focus_search_input',
      type: '',
    },
  },
  player: {
    toggle_play: {
      name: 'toggle_play',
      action: 'toggle_play',
      type: '',
    },
    next: {
      name: 'next',
      action: 'next',
      type: '',
    },
    prev: {
      name: 'prev',
      action: 'prev',
      type: '',
    },
    seekbackward: {
      name: 'seekbackward',
      action: 'seekbackward',
      type: '',
    },
    seekforward: {
      name: 'seekforward',
      action: 'seekforward',
      type: '',
    },
    volume_up: {
      name: 'volume_up',
      action: 'volume_up',
      type: '',
    },
    volume_down: {
      name: 'volume_down',
      action: 'volume_down',
      type: '',
    },
    volume_mute: {
      name: 'volume_mute',
      action: 'volume_mute',
      type: '',
    },
    music_love: {
      name: 'music_love',
      action: 'music_love',
      type: '',
    },
    music_unlove: {
      name: 'music_unlove',
      action: 'music_unlove',
      type: '',
    },
    music_dislike: {
      name: 'music_dislike',
      action: 'music_dislike',
      type: '',
    },
  },
}

for (const type of Object.keys(hotKey) as Array<keyof typeof hotKey>) {
  let keys = hotKey[type]
  for (const key of Object.keys(keys) as Array<keyof typeof keys>) {
    const keyInfo: LX.HotKey = keys[key]
    keyInfo.action = `${type}_${keyInfo.action}`
    keyInfo.name = `${type}_${keyInfo.name}`
    keyInfo.type = keyName[type] as keyof typeof hotKey
  }
}

export const HOTKEY_COMMON = hotKey.common
export const HOTKEY_PLAYER = hotKey.player
