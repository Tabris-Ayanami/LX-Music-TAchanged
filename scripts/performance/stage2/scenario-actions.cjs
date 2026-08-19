const path = require('node:path')

const LOCAL_LIBRARY_KEY = 'lx_local_music_library_folders'

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

const isPathInside = (workspaceRoot, candidate) => {
  const root = path.resolve(workspaceRoot)
  const target = path.resolve(candidate)
  const relative = path.relative(root, target)
  return relative == '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

const toExpression = (operation, payload) => `(${operation.toString()})(${JSON.stringify(payload)})`

const createScenarioActions = ({
  evaluate,
  sleep = delay,
  pollIntervalMs = 100,
  timeoutMs = 30_000,
}) => {
  if (typeof evaluate != 'function' && typeof evaluate?.evaluate != 'function') {
    throw new TypeError('evaluate must be a CDP evaluator function or expose evaluate(expression)')
  }

  const runEvaluation = async(action, payload, operation) => {
    const evaluator = typeof evaluate == 'function' ? evaluate : evaluate.evaluate.bind(evaluate)
    return evaluator(toExpression(operation, payload), { action, payload })
  }

  const waitFor = async(action, payload, operation, accept, failureMessage) => {
    const startedAt = Date.now()
    let lastValue
    do {
      lastValue = await runEvaluation(action, payload, operation)
      if (accept(lastValue)) return lastValue
      await sleep(pollIntervalMs)
    } while (Date.now() - startedAt < timeoutMs)
    throw new Error(`${failureMessage}; last observed value: ${JSON.stringify(lastValue)}`)
  }

  const navigate = async route => {
    await runEvaluation('navigate', { route }, ({ route: nextRoute }) => {
      window.location.hash = nextRoute
      return window.location.hash
    })
    await waitFor(
      'read-route',
      { route },
      () => window.location.hash,
      currentRoute => currentRoute == route,
      `Timed out waiting for route ${route}`,
    )
    return route
  }

  const waitForList = async({ minimum = 1, kind }) => waitFor(
    'read-list-count',
    { minimum, kind },
    ({ kind: listKind }) => {
      const selectors = listKind == 'search'
        ? ['#view .list-item']
        : listKind == 'albums'
          ? ['#view [role="listitem"]', '#view [class*="album"] button', '#view [class*="groupCard"]']
          : ['#view [class*="listShell"] button', '#view .list-item']
      const items = selectors.flatMap(selector => Array.from(document.querySelectorAll(selector)))
      return new Set(items.filter(element => {
        const style = window.getComputedStyle(element)
        return style.display != 'none' && style.visibility != 'hidden'
      })).size
    },
    count => Number.isInteger(count) && count >= minimum,
    `Timed out waiting for ${minimum} rendered ${kind} items`,
  )

  const waitForDiscoverContent = async() => waitFor(
    'read-list-count',
    { minimum: 1, kind: 'discover' },
    () => Array.from(document.querySelectorAll('#view section')).filter(element => {
      const style = window.getComputedStyle(element)
      return style.display != 'none' && style.visibility != 'hidden'
    }).length,
    count => Number.isInteger(count) && count >= 1,
    'Timed out waiting for rendered Discover content',
  )

  const scrollPage = async() => {
    const result = await runEvaluation(
      'scroll-page',
      { passes: 8 },
      async({ passes }) => {
        const view = document.querySelector('#view')
        if (!view) return { error: 'Discover #view root was not found' }
        const directChildren = new Set(Array.from(view.children || []))
        const visible = element => {
          const style = window.getComputedStyle(element)
          const rect = element.getBoundingClientRect()
          return style.display != 'none' && style.visibility != 'hidden' &&
            element.getClientRects().length > 0 && rect.width > 0 && rect.height > 0
        }
        const candidates = [...new Set([...directChildren, ...Array.from(view.querySelectorAll('*'))])]
          .filter(element => {
            const style = window.getComputedStyle(element)
            return visible(element) && /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight
          })
        const score = element => {
          const className = typeof element.className == 'string' ? element.className : ''
          const classTokens = className.split(/\s+/)
          const activeView = directChildren.has(element) && classTokens.includes('view-container') ? 1_000_000 : 0
          const discoverPage = /(?:^|[_\s-])page(?:$|[_\s-])/i.test(className) ? 100_000 : 0
          return activeView + discoverPage + element.scrollHeight - element.clientHeight
        }
        const container = candidates.sort((a, b) => score(b) - score(a))[0]
        if (!container) return { error: 'No visible scrollable Discover page container was found' }

        container.scrollTop = 0
        await new Promise(resolve => setTimeout(resolve, 50))
        const initialArtwork = new Set()
        const artwork = new Set()
        const collect = target => {
          const viewport = container.getBoundingClientRect()
          for (const element of container.querySelectorAll('img, [style*="background"]')) {
            if (!visible(element)) continue
            const rect = element.getBoundingClientRect()
            if (rect.bottom <= viewport.top || rect.top >= viewport.bottom || rect.right <= viewport.left || rect.left >= viewport.right) continue
            const imageUrl = element.currentSrc || element.src
            if (imageUrl) target.add(imageUrl)
            const background = window.getComputedStyle(element).backgroundImage
            const match = background?.match(/^url\(["']?(.*?)["']?\)$/)
            if (match?.[1]) target.add(match[1])
          }
        }
        collect(initialArtwork)
        for (const url of initialArtwork) artwork.add(url)
        const before = container.scrollTop
        const maximum = Math.max(0, container.scrollHeight - container.clientHeight)
        let completedPasses = 0
        for (let index = 0; index < passes && container.scrollTop < maximum; index++) {
          const previous = container.scrollTop
          container.scrollTop = Math.min(maximum, previous + Math.max(1, Math.floor(container.clientHeight * 0.8)))
          await new Promise(resolve => setTimeout(resolve, 100))
          collect(artwork)
          if (container.scrollTop <= previous) break
          completedPasses++
        }
        const after = container.scrollTop
        const newArtworkIdentities = Array.from(artwork).filter(url => !initialArtwork.has(url))
        return {
          artworkIdentities: Array.from(artwork),
          newArtworkIdentities,
          scroll: {
            before,
            after,
            maximum,
            passes: completedPasses,
            container: {
              id: container.id || '',
              className: typeof container.className == 'string' ? container.className : '',
            },
          },
        }
      },
    )
    if (result?.error) throw new Error(result.error)
    if (!result?.scroll || result.scroll.after <= result.scroll.before) {
      throw new Error(`Discover page did not make scroll progress: ${JSON.stringify(result?.scroll ?? null)}`)
    }
    if (!Array.isArray(result.newArtworkIdentities) || result.newArtworkIdentities.length == 0) {
      throw new Error('Discover scroll did not collect any newly reached artwork identities')
    }
    return result
  }

  const collectArtworkIdentities = async minimum => {
    const identities = await runEvaluation(
      'collect-artwork-identities',
      { minimum },
      async({ minimum: required }) => {
        const urls = new Set()
        const scrollContainers = Array.from(document.querySelectorAll('#view *')).filter(element => {
          const style = window.getComputedStyle(element)
          return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight
        })
        const container = scrollContainers.sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
        const collect = () => {
          for (const image of document.querySelectorAll('#view img')) {
            const url = image.currentSrc || image.src
            if (url) urls.add(url)
          }
          for (const element of document.querySelectorAll('#view [style*="background"]')) {
            const match = window.getComputedStyle(element).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)
            if (match?.[1]) urls.add(match[1])
          }
        }
        let unchangedPasses = 0
        let previousSize = -1
        for (let pass = 0; pass < 400 && urls.size < required && unchangedPasses < 20; pass++) {
          collect()
          if (urls.size == previousSize) unchangedPasses++
          else unchangedPasses = 0
          previousSize = urls.size
          if (container) container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + Math.max(1, container.clientHeight * 0.8))
          else window.scrollBy(0, Math.max(1, window.innerHeight * 0.8))
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        collect()
        return Array.from(urls)
      },
    )
    const distinct = Array.from(new Set(Array.isArray(identities) ? identities.filter(Boolean) : []))
    if (distinct.length < minimum) {
      throw new Error(`Expected at least ${minimum} distinct artwork identities, observed ${distinct.length}`)
    }
    return distinct
  }

  const readSettings = async keys => runEvaluation(
    'read-settings',
    { keys },
    ({ keys: settingKeys }) => Object.fromEntries(settingKeys.map(key => [key, window.lxData.appSetting[key]])),
  )

  const writeSettings = async patch => runEvaluation(
    'write-settings',
    { patch },
    ({ patch: nextSettings }) => {
      Object.assign(window.lxData.appSetting, nextSettings)
      window.lxData.updateSetting(nextSettings)
      return Object.fromEntries(Object.keys(nextSettings).map(key => [key, window.lxData.appSetting[key]]))
    },
  )

  const playCopiedTrack = async trackPath => runEvaluation(
    'play-copied-track',
    { trackPath },
    ({ trackPath: expectedPath }) => {
      const normalize = value => String(value || '').replaceAll('\\', '/').toLowerCase()
      const current = window.lxData.playMusicInfo?.musicInfo?.meta?.filePath
      if (normalize(current) == normalize(expectedPath)) return true
      const button = document.querySelector('#view [class*="listShell"] button') || document.querySelector('#view .list-item')
      if (!button) return false
      button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      return true
    },
  )

  const waitForPlaybackReady = async trackPath => waitFor(
    'read-playback-ready',
    { trackPath },
    ({ trackPath: expectedPath }) => {
      const normalize = value => String(value || '').replaceAll('\\', '/').toLowerCase()
      const current = window.lxData.playMusicInfo?.musicInfo?.meta?.filePath
      return normalize(current) == normalize(expectedPath) && Boolean(window.lxData.musicInfo?.id)
    },
    Boolean,
    `Timed out waiting for copied track playback: ${trackPath}`,
  )

  const openPlayerDetail = async() => runEvaluation(
    'open-player-detail',
    {},
    () => {
      const trigger = document.querySelector('[data-play-floating-cover="true"]')?.closest('button') ||
        document.querySelector('[aria-label][class*="picContent"]')
      if (!trigger) return false
      trigger.click()
      return true
    },
  )

  const enterImmersivePlayer = async() => runEvaluation(
    'enter-immersive-player',
    {},
    () => {
      const trigger = document.querySelector('button[class*="immersiveDockBtn"]')
      if (!trigger) return false
      trigger.click()
      return true
    },
  )

  const waitForVisiblePlayerControls = async mode => waitFor(
    'read-visible-player-controls',
    { mode },
    ({ mode: expectedMode }) => {
      const visible = element => {
        if (!element) return false
        const style = window.getComputedStyle(element)
        return style.display != 'none' && style.visibility != 'hidden' && element.getClientRects().length > 0
      }
      if (expectedMode == 'normal') {
        return Array.from(document.querySelectorAll('button')).some(button => visible(button) && button.querySelector('use[href*="pause"], use[xlink\\:href*="pause"]'))
      }
      if (expectedMode == 'diorama') return visible(document.querySelector('.folia-visualizer-root canvas'))
      if (expectedMode == 'aura') return visible(document.querySelector('[class*="aurora"], canvas'))
      return visible(document.querySelector('.folia-visualizer-root'))
    },
    Boolean,
    `Timed out waiting for visible ${mode} player controls`,
  )

  const writeLibraryFolders = async({ workspaceRoot, folders }) => {
    for (const folder of folders) {
      if (!isPathInside(workspaceRoot, folder)) throw new Error(`Library folder is outside the Stage 2 workspace: ${folder}`)
    }
    return runEvaluation(
      'write-library-folders',
      { folders },
      ({ folders: destinationFolders }) => {
        window.localStorage.setItem('lx_local_music_library_folders', JSON.stringify(destinationFolders))
        return JSON.parse(window.localStorage.getItem('lx_local_music_library_folders') || '[]')
      },
    )
  }

  const waitForVisibleScanControl = async() => waitFor(
    'read-visible-scan-control',
    {},
    () => Array.from(document.querySelectorAll('button')).some(button => {
      const style = window.getComputedStyle(button)
      return button.textContent?.trim() == '重新扫描' && !button.disabled && style.display != 'none' && style.visibility != 'hidden'
    }),
    Boolean,
    'Timed out waiting for the visible local-library rescan control',
  )

  const waitForVisibleSettingPage = async() => waitFor(
    'read-visible-setting-page',
    {},
    () => {
      const marker = document.querySelector('#local_music_library') || document.querySelector('#view dt')
      if (!marker) return false
      const style = window.getComputedStyle(marker)
      return style.display != 'none' && style.visibility != 'hidden'
    },
    Boolean,
    'Timed out waiting for rendered Settings content',
  )

  const clickLibraryScan = async() => runEvaluation(
    'click-library-scan',
    {},
    () => {
      const button = Array.from(document.querySelectorAll('button')).find(element => element.textContent?.trim() == '重新扫描')
      if (!button || button.disabled) return false
      button.click()
      return true
    },
  )

  const waitForLibraryScanComplete = async() => waitFor(
    'read-library-scan-complete',
    {},
    () => {
      const text = document.body.innerText
      if (text.includes('扫描失败：')) return { complete: false, failed: true, text }
      return { complete: text.includes('扫描完成：'), failed: false, text }
    },
    result => {
      if (result?.failed) throw new Error('Local library scan reported failure')
      return result?.complete == true
    },
    'Timed out waiting for local-library scan completion text',
  )

  return Object.freeze({
    clickLibraryScan,
    collectArtworkIdentities,
    enterImmersivePlayer,
    navigate,
    openPlayerDetail,
    playCopiedTrack,
    readSettings,
    scrollPage,
    stabilize: sleep,
    waitForDiscoverContent,
    waitForLibraryScanComplete,
    waitForList,
    waitForPlaybackReady,
    waitForVisiblePlayerControls,
    waitForVisibleScanControl,
    waitForVisibleSettingPage,
    writeLibraryFolders,
    writeSettings,
  })
}

module.exports = {
  LOCAL_LIBRARY_KEY,
  createScenarioActions,
  isPathInside,
}
