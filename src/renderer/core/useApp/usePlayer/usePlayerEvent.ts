import { onBeforeUnmount } from '@common/utils/vueTools'
import { backend } from '@renderer/backend'


export default () => {
  const rOnPlaying = backend.player.on('playing', () => {
    console.log('onPlaying')
    window.app_event.playerPlaying()
    window.app_event.play()
  })
  const rOnPause = backend.player.on('pause', () => {
    console.log('onPause')
    window.app_event.playerPause()
    window.app_event.pause()
  })
  const rOnEnded = backend.player.on('ended', () => {
    console.log('onEnded')
    window.app_event.playerEnded()
    // window.app_event.pause()
  })
  const rOnError = backend.player.on('error', () => {
    console.log('onError')
    const errorCode = backend.player.getErrorCode()
    window.app_event.error(errorCode)
    window.app_event.playerError(errorCode)
  })
  const rOnLoadeddata = backend.player.on('loadeddata', () => {
    console.log('onLoadeddata')
    window.app_event.playerLoadeddata()
  })
  const rOnLoadstart = backend.player.on('loadstart', () => {
    console.log('onLoadstart')
    window.app_event.playerLoadstart()
  })
  const rOnCanplay = backend.player.on('canplay', () => {
    console.log('onCanplay')
    window.app_event.playerCanplay()
  })
  const rOnEmptied = backend.player.on('emptied', () => {
    console.log('onEmptied')
    window.app_event.playerEmptied()
    // window.app_event.stop()
  })
  const rOnWaiting = backend.player.on('waiting', () => {
    console.log('onWaiting')
    window.app_event.pause()
    window.app_event.playerWaiting()
  })


  onBeforeUnmount(() => {
    rOnPlaying()
    rOnPause()
    rOnEnded()
    rOnError()
    rOnLoadeddata()
    rOnLoadstart()
    rOnCanplay()
    rOnEmptied()
    rOnWaiting()
  })
}
