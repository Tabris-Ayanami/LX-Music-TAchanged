import type { I18n } from '@root/lang/i18n'

// sync(store, router)

const escapeHtml = (text: string) => text.replace(/[<>&]/g, s => {
  switch (s) {
    case '<': return '&lt;'
    case '>': return '&gt;'
    default: return '&amp;'
  }
})

const appendStartupLog = (title: string, error: unknown) => {
  try {
    const message = error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : typeof error == 'string'
        ? error
        : JSON.stringify(error, null, 2)
    console.error(`[LX-TA] ${title}`, error)
    const key = 'lx-ta-renderer-startup-log'
    const prev = window.localStorage.getItem(key) ?? ''
    const next = `${prev}[${new Date().toISOString()}] ${title}\n${message}\n\n`
    window.localStorage.setItem(key, next.slice(-20_000))
  } catch {}
}

const markBootstrapped = () => {
  ;(window as typeof window & { __lxRendererBootstrapped?: boolean }).__lxRendererBootstrapped = true
}

const showStartupError = (title: string, error: unknown) => {
  markBootstrapped()
  appendStartupLog(title, error)
  const root = document.getElementById('root')
  if (root) root.style.display = 'block'
  const message = String(
    error instanceof Error
      ? `${error.name}: ${error.message}\n${error.stack ?? ''}`
      : error,
  )
  document.body.style.background = '#f5f6fa'
  document.body.innerHTML = `
    <div style="box-sizing:border-box;padding:24px;font-family:Segoe UI,Microsoft YaHei,sans-serif;color:#1f2937;line-height:1.5;">
      <h1 style="margin:0 0 12px;font-size:24px;">LX-TA startup failed</h1>
      <p style="margin:0 0 12px;">Renderer startup crashed. Please send the details below.</p>
      <pre style="white-space:pre-wrap;word-break:break-word;padding:16px;border-radius:12px;background:#ffffff;border:1px solid #dbe2f0;">${escapeHtml(message)}</pre>
    </div>
  `
}

window.addEventListener('error', event => {
  showStartupError('window.error', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', event => {
  showStartupError('window.unhandledrejection', event.reason)
})

void (async() => {
  try {
    await import('@common/error')
    const { createApp } = await import('vue')
    await import('./core/globalData')
    await import('@renderer/event')
    const { default: mountComponents } = await import('./components')
    const { default: initPlugins } = await import('./plugins')
    const { i18nPlugin } = await import('./plugins/i18n')
    const { default: App } = await import('./App.vue')
    const { default: router } = await import('./router')
    const { getSetting, updateSetting } = await import('./utils/ipc')
    const { langList } = await import('@root/lang')
    const { initSetting } = await import('./store/setting')
    await import('./worker')
    const { saveViewPrevState } = await import('./utils/data')

    router.afterEach((to) => {
      if (to.path != '/songList/detail') {
        saveViewPrevState({
          url: to.path,
          query: { ...to.query },
        })
      }
    })

    const setting = await getSetting()
    // window.lx.appSetting = setting
    // Set language automatically
    if (!setting['common.langId'] || !window.i18n.availableLocales.includes(setting['common.langId'])) {
      let langId: I18n['locale'] | null = null
      const locale = window.navigator.language.toLocaleLowerCase() as I18n['locale']
      if (window.i18n.availableLocales.includes(locale)) {
        langId = locale
      } else {
        for (const lang of langList) {
          if (lang.alternate == locale) {
            langId = lang.locale
            break
          }
        }
        langId ??= 'en-us'
      }
      setting['common.langId'] = langId
      void updateSetting({ 'common.langId': langId })
      console.log('Set lang', setting['common.langId'])
    }
    window.setLang(setting['common.langId'])
    window.i18n.setLanguage(setting['common.langId'])

    if (!setting['common.startInFullscreen'] && (document.body.clientHeight > window.screen.availHeight || document.body.clientWidth > window.screen.availWidth) && setting['common.windowSizeId'] > 1) {
      void updateSetting({ 'common.windowSizeId': 1 })
    }

    // store.commit('setSetting', setting)
    initSetting(setting)

    const root = document.getElementById('root')
    if (root) root.style.display = 'block'
    const app = createApp(App)
    app.config.errorHandler = (error, instance, info) => {
      appendStartupLog(`vue.error:${info}`, error)
      showStartupError(`vue.error:${info}`, error)
    }
    app
      .use(router)
      // .use(store)
      .use(i18nPlugin)
    initPlugins(app)
    mountComponents(app)
    app.mount('#root')
    markBootstrapped()
  } catch (error) {
    showStartupError('startup.bootstrap', error)
  }
})()

// bubbleCursor()
