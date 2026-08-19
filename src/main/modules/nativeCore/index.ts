import { app } from 'electron'
import { shutdownNativeCore } from './supervisor'

export default () => {
  app.once('before-quit', () => { void shutdownNativeCore() })
}

export * from './supervisor'
