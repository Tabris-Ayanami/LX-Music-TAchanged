<template lang="pug">
dt#basic {{ $t('setting__basic') }}
dd
  div
    .gap-top
      base-checkbox(id="setting_show_animate" :model-value="appSetting['common.isShowAnimation']" :label="$t('setting__basic_show_animation')" @update:model-value="updateSetting({'common.isShowAnimation': $event})")
    .gap-top
      base-checkbox(id="setting_animate" :disabled="!appSetting['common.isShowAnimation']" :model-value="appSetting['common.randomAnimate']" :label="$t('setting__basic_animation')" @update:model-value="updateSetting({'common.randomAnimate': $event})")
    .gap-top
      base-checkbox(id="setting_start_in_fullscreen" :model-value="appSetting['common.startInFullscreen']" :label="$t('setting__basic_start_in_fullscreen')" @update:model-value="updateSetting({'common.startInFullscreen': $event})")
    .gap-top
      base-checkbox(id="setting_to_tray" :model-value="appSetting['tray.enable']" :label="$t('setting__basic_to_tray')" @update:model-value="updateSetting({'tray.enable': $event})")
    .p.gap-top
      base-btn.btn(min @click="isShowPlayTimeoutModal = true") {{ $t('setting__play_timeout')}} {{ timeLabel ? ` (${timeLabel})` : '' }}

dd
  h3#basic_theme {{ $t('setting__basic_theme') }}
  div
    .gap-top(:class="$style.themeComposer")
      label(:class="$style.themePreview" :style="{ '--theme-preview': themePreviewColor }" :aria-label="$t('theme_edit_modal__pick_color')")
        input(type="color" :class="$style.themePicker" :value="themePreviewHexColor" @input="handlePickThemeColor")
      base-input(v-model="typedThemeColor" :class="$style.themeInput" placeholder="#73BCFC / rgb(115, 188, 252)" @submit="applyTypedTheme")
      base-btn.btn(min :disabled="!typedThemeColorNormalized" @click="applyTypedTheme") 应用
    ul(:class="$style.theme")
      li(
        v-for="theme in themeList"
        :key="theme.id"
        :aria-label="theme.isDraft ? '新建主题颜色' : theme.label || theme.name"
        :style="theme.styles"
        :class="[$style.themeItem, {[$style.active]: selectedThemeCardId == theme.id}, {[$style.themeDraft]: theme.isDraft}]"
        @click="toggleTheme(theme)"
        @contextmenu.prevent="handleThemeContextMenu(theme)"
      )
        div(:class="$style.bg")
        span(:class="$style.label") {{ theme.label }}
      li(:class="[$style.themeItem, $style.themeAdd]" aria-label="新建主题颜色" @click="createEmptyTheme")
        div(:class="$style.bg")
        span(:class="$style.label") +

dd
  h3#basic_source {{ $t('setting__basic_source') }}
  div
    .gap-top(v-for="item in apiSources" :key="item.id")
      base-checkbox(
        :id="`setting_api_source_${item.id}`" name="setting_api_source"
        need :model-value="appSetting['common.apiSource']" :disabled="item.disabled" :value="item.id" :aria-label="item.label" @update:model-value="updateSetting({'common.apiSource': $event})")
        span(:class="$style.sourceLabel")
          | {{ item.name }}
          span(v-if="item.desc" :class="$style.desc") {{ item.desc }}
          span(v-if="item.statusLabel" :class="$style.status") {{ item.statusLabel }}
    .p.gap-top
      base-btn.btn(min @click="isShowUserApiModal = true") {{ $t('setting__basic_source_user_api_btn') }}

dd
  h3#basic_window_size {{ $t('setting__basic_window_size') }}
  div
    base-checkbox.gap-left(
      v-for="item in windowSizeList" :id="`setting_window_size_${item.id}`" :key="item.id"
      name="setting_window_size" need :model-value="appSetting['common.windowSizeId']" :disabled="isFullscreen" :value="item.id" :label="$t('setting__basic_window_size_' + item.name)"
      @update:model-value="updateSetting({'common.windowSizeId': $event})")

dd
  h3#basic_font_size {{ $t('setting__basic_font_size') }}
  div
    base-checkbox.gap-left(
      v-for="item in fontSizeList" :id="`setting_basic_font_size_${item.id}`" :key="item.id"
      name="setting_basic_font_size" need :model-value="appSetting['common.fontSize']" :value="item.id"
      :label="item.label" :disabled="isFullscreen" @update:model-value="updateSetting({'common.fontSize': $event})")

dd
  h3#basic_font {{ $t('setting__basic_font') }}
  div(style="--selection-width: 12rem;")
    base-selection.gap-left(:list="fontList" :model-value="fonts[0]" item-key="id" item-name="label" @update:model-value="updateFonts($event, fonts[1])")
    base-selection.gap-left(v-if="fonts[0]" :list="fontList" :model-value="fonts[1]" item-key="id" item-name="label" @update:model-value="updateFonts(fonts[0], $event)")

dd
  h3#basic_lang {{ $t('setting__basic_lang') }}
  div
    base-checkbox.gap-left(
      v-for="item in langList" :id="`setting_lang_${item.locale}`" :key="item.locale" name="setting_lang"
      need :model-value="appSetting['common.langId']" :value="item.locale" :label="item.name" @update:model-value="updateSetting({'common.langId': $event})")

dd
  h3#basic_sourcename {{ $t('setting__basic_sourcename') }}
  div
    base-checkbox.gap-left(
      v-for="item in sourceNameTypes" :id="`setting_abasic_sourcename_${item.id}`" :key="item.id"
      name="setting_basic_sourcename" need :model-value="appSetting['common.sourceNameType']" :value="item.id" :label="item.label" @update:model-value="updateSetting({'common.sourceNameType': $event})")

play-timeout-modal(v-model="isShowPlayTimeoutModal")
user-api-modal(v-model="isShowUserApiModal")
</template>

<script>
import { computed, ref, shallowReactive, watch } from '@common/utils/vueTools'
import { windowSizeList, userApi, isFullscreen, themeId, themeInfo } from '@renderer/store'
import { langList, useI18n } from '@root/lang'
import { getSystemFonts, removeTheme as removeSavedTheme, saveTheme } from '@renderer/utils/ipc'
import apiSourceInfo from '@renderer/utils/musicSdk/api-source-info'
import { useTimeout } from '@renderer/core/player/timeoutStop'
import { createThemeColors } from '@common/theme/utils'

import PlayTimeoutModal from './PlayTimeoutModal.vue'
import UserApiModal from './UserApiModal.vue'
import { appSetting, updateSetting } from '@renderer/store/setting'
import { getThemes, applyTheme, copyTheme, findTheme } from '@renderer/store/utils'

export default {
  name: 'SettingBasic',
  components: {
    PlayTimeoutModal,
    UserApiModal,
  },
  setup() {
    const t = useI18n()

    const isSolidTheme = theme => {
      const backgroundImage = theme.config?.extInfo?.['--background-image']
      return !backgroundImage || backgroundImage == 'none'
    }
    const normalizeColorInput = value => {
      const text = value.trim()
      if (!text) return ''
      const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
      if (hex) {
        return text.length == 4
          ? `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toUpperCase()
          : text.toUpperCase()
      }
      const rgb = text.match(/^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i)
      if (rgb) {
        const channels = rgb.slice(1).map(v => Math.max(0, Math.min(255, Number.parseInt(v))))
        return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
      }
      const rgba = text.match(/^rgba\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*((?:0|1)(?:\.\d+)?)\s*\)$/i)
      if (!rgba) return ''
      const channels = rgba.slice(1, 4).map(v => Math.max(0, Math.min(255, Number.parseInt(v))))
      const alpha = Math.max(0, Math.min(1, Number.parseFloat(rgba[4])))
      if (alpha >= 1) return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`
      return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${Number(alpha.toFixed(3))})`
    }
    const colorToHex = value => {
      const normalized = normalizeColorInput(value)
      if (!normalized) return '#73BCFC'
      if (normalized.startsWith('#')) {
        return normalized.length == 4
          ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toUpperCase()
          : normalized.toUpperCase()
      }
      const channels = normalized.match(/\d{1,3}/g)?.slice(0, 3)?.map(v => Math.max(0, Math.min(255, Number.parseInt(v))))
      if (!channels?.length) return '#73BCFC'
      return `#${channels.map(channel => channel.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
    }
    const getThemeLabel = color => color.startsWith('rgb')
      ? color.replace(/\s+/g, '')
      : color.toUpperCase()
    const HIDDEN_DEFAULT_THEMES_KEY = 'lx_hidden_theme_card_ids'
    const getHiddenDefaultThemeIds = () => {
      try {
        const value = JSON.parse(window.localStorage.getItem(HIDDEN_DEFAULT_THEMES_KEY) ?? '[]')
        return Array.isArray(value) ? value.filter(id => typeof id == 'string') : []
      } catch {
        return []
      }
    }
    const createThemeCard = ({ id, name = '', themeColor = '', isDefault = false, isDraft = false }) => ({
      id,
      name,
      themeColor,
      isDefault,
      isDraft,
      label: themeColor ? getThemeLabel(themeColor) : '',
      styles: {
        '--color-primary-theme': themeColor || 'rgba(255,255,255,0.08)',
      },
    })

    const defaultThemesRaw = shallowReactive([])
    const hiddenDefaultThemeIds = ref(getHiddenDefaultThemeIds())
    const saveHiddenDefaultThemeIds = () => {
      try {
        window.localStorage.setItem(HIDDEN_DEFAULT_THEMES_KEY, JSON.stringify(hiddenDefaultThemeIds.value))
      } catch {}
    }
    const defaultThemes = computed(() => defaultThemesRaw
      .filter(theme => !hiddenDefaultThemeIds.value.includes(theme.id))
      .map(theme => createThemeCard({ ...theme, isDefault: true })))
    const userThemes = shallowReactive([])
    const draftTheme = ref(null)
    const themeList = computed(() => draftTheme.value
      ? [...defaultThemes.value, ...userThemes, draftTheme.value]
      : [...defaultThemes.value, ...userThemes])
    const removableThemeCount = computed(() => themeList.value.filter(theme => !theme.isDraft).length)
    const selectedThemeCardId = ref('')
    const typedThemeColor = ref('')
    const typedThemeColorNormalized = computed(() => normalizeColorInput(typedThemeColor.value))
    const selectedThemeCard = computed(() => themeList.value.find(theme => theme.id == selectedThemeCardId.value) ?? null)
    const themePreviewColor = computed(() => typedThemeColorNormalized.value || selectedThemeCard.value?.themeColor || 'rgba(255,255,255,0.18)')
    const themePreviewHexColor = computed(() => colorToHex(themePreviewColor.value))

    const syncTypedThemeColor = theme => {
      typedThemeColor.value = theme?.themeColor ?? ''
    }
    const findThemeCardById = id => themeList.value.find(theme => theme.id == id) ?? null
    const getFallbackTheme = removedId => themeList.value.find(theme => !theme.isDraft && theme.id != removedId) ?? null
    const applySelectedTheme = theme => {
      if (!theme) return
      themeId.value = theme.id
      applyTheme(theme.id, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
      updateSetting({ 'theme.id': theme.id })
    }
    const syncThemeSelectionAfterDelete = removedId => {
      const fallbackTheme = getFallbackTheme(removedId)
      if (themeId.value == removedId && fallbackTheme) {
        applySelectedTheme(fallbackTheme)
        selectedThemeCardId.value = fallbackTheme.id
        syncTypedThemeColor(fallbackTheme)
        return
      }

      if (selectedThemeCardId.value == removedId) {
        const currentTheme = findThemeCardById(themeId.value) ?? fallbackTheme
        selectedThemeCardId.value = currentTheme?.id ?? ''
        syncTypedThemeColor(currentTheme)
      }
    }

    let dataPath = ''
    const init = () => {
      getThemes((info) => {
        dataPath = info.dataPath
        defaultThemesRaw.splice(0, defaultThemesRaw.length, ...info.themes.filter(isSolidTheme).map(t => {
          const themeColor = t.config.themeColors['--color-theme']
          return {
            id: t.id,
            name: t.name,
            themeColor,
          }
        }))
        userThemes.splice(0, userThemes.length, ...info.userThemes.filter(isSolidTheme).map(t => {
          return createThemeCard({
            id: t.id,
            name: t.name,
            themeColor: t.config.themeColors['--color-theme'],
          })
        }))
        const currentThemeId = themeId.value || appSetting['theme.id']
        selectedThemeCardId.value = findThemeCardById(currentThemeId)?.id ?? defaultThemes.value[0]?.id ?? ''
        syncTypedThemeColor(findThemeCardById(selectedThemeCardId.value))
      })
    }
    init()

    watch(() => themeId.value, id => {
      if (!id || selectedThemeCard.value?.isDraft) return
      const resolvedTheme = findThemeCardById(id) ?? defaultThemes.value[0] ?? userThemes[0] ?? null
      selectedThemeCardId.value = resolvedTheme?.id ?? ''
      syncTypedThemeColor(resolvedTheme)
    }, { immediate: true })

    const toggleTheme = theme => {
      selectedThemeCardId.value = theme.id
      syncTypedThemeColor(theme)
      if (theme.isDraft || themeId.value == theme.id) return
      themeId.value = theme.id
      applyTheme(theme.id, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
      updateSetting({ 'theme.id': theme.id })
    }

    const getSolidBaseTheme = () => {
      const active = findTheme(themeInfo, themeId.value || appSetting['theme.id'])
      if (active && isSolidTheme(active)) return copyTheme(active)
      const fallback = themeInfo.themes.find(isSolidTheme) ?? themeInfo.themes[0]
      return copyTheme(fallback)
    }
    const getSelectedBaseTheme = themeCard => {
      if (!themeCard?.isDraft) {
        const selectedTheme = findTheme(themeInfo, themeCard.id)
        if (selectedTheme && isSolidTheme(selectedTheme)) return copyTheme(selectedTheme)
      }
      return getSolidBaseTheme()
    }

    const createEmptyTheme = () => {
      if (!draftTheme.value) {
        draftTheme.value = createThemeCard({
          id: `draft_theme_${Date.now()}`,
          isDraft: true,
        })
      }
      selectedThemeCardId.value = draftTheme.value.id
      typedThemeColor.value = ''
    }

    const applyTypedTheme = async() => {
      const color = typedThemeColorNormalized.value
      const selected = selectedThemeCard.value
      if (!color || !selected) return

      const targetTheme = getSelectedBaseTheme(selected)
      const fontColor = targetTheme.config.themeColors['--color-1000'] ?? (targetTheme.isDark ? 'rgb(229, 229, 229)' : 'rgb(33, 33, 33)')
      const isUpdatingUserTheme = !selected.isDefault && !selected.isDraft

      targetTheme.id = isUpdatingUserTheme ? selected.id : `user_theme_${Date.now()}`
      targetTheme.name = getThemeLabel(color)
      targetTheme.isCustom = true
      targetTheme.config.themeColors = createThemeColors(color, fontColor, targetTheme.isDark, targetTheme.isDarkFont ?? false)
      targetTheme.config.extInfo['--background-image'] = 'none'

      await saveTheme(targetTheme)

      const themeCard = createThemeCard({
        id: targetTheme.id,
        name: targetTheme.name,
        themeColor: color,
      })

      if (isUpdatingUserTheme) {
        const index = userThemes.findIndex(theme => theme.id == targetTheme.id)
        if (index > -1) userThemes.splice(index, 1, themeCard)
        else userThemes.push(themeCard)

        const userThemeIndex = themeInfo.userThemes.findIndex(theme => theme.id == targetTheme.id)
        if (userThemeIndex > -1) themeInfo.userThemes.splice(userThemeIndex, 1, targetTheme)
        else themeInfo.userThemes.push(targetTheme)
      } else {
        draftTheme.value = null
        userThemes.push(themeCard)
        themeInfo.userThemes.push(targetTheme)
      }

      selectedThemeCardId.value = targetTheme.id
      typedThemeColor.value = color
      themeId.value = targetTheme.id
      applyTheme(targetTheme.id, appSetting['theme.lightId'], appSetting['theme.darkId'], dataPath)
      updateSetting({ 'theme.id': targetTheme.id })
    }

    const handlePickThemeColor = event => {
      typedThemeColor.value = event.target.value.toUpperCase()
    }

    const handleThemeContextMenu = theme => {
      if (removableThemeCount.value <= 1) return

      if (theme.isDefault) {
        hiddenDefaultThemeIds.value = [...new Set([...hiddenDefaultThemeIds.value, theme.id])]
        saveHiddenDefaultThemeIds()
        syncThemeSelectionAfterDelete(theme.id)
        return
      }

      if (theme.isDraft) {
        draftTheme.value = null
        selectedThemeCardId.value = themeId.value || appSetting['theme.id']
        syncTypedThemeColor(findThemeCardById(selectedThemeCardId.value))
        return
      }

      void removeSavedTheme(theme.id).then(() => {
        const index = userThemes.findIndex(item => item.id == theme.id)
        if (index > -1) userThemes.splice(index, 1)

        const userThemeIndex = themeInfo.userThemes.findIndex(item => item.id == theme.id)
        if (userThemeIndex > -1) themeInfo.userThemes.splice(userThemeIndex, 1)
        syncThemeSelectionAfterDelete(theme.id)
      })
    }

    const isShowPlayTimeoutModal = ref(false)
    const { timeLabel } = useTimeout()

    const isShowUserApiModal = ref(false)
    const getApiStatus = () => {
      let status
      if (userApi.status) status = t('setting__basic_source_status_success')
      else if (userApi.message == 'initing') status = t('setting__basic_source_status_initing')
      else status = `${t('setting__basic_source_status_failed')}`

      return status
    }
    const apiSources = computed(() => {
      return [
        ...apiSourceInfo.map(api => ({
          id: api.id,
          name: api.name,
          label: api.name,
          disabled: api.disabled,
        })),
        ...userApi.list.map(api => ({
          id: api.id,
          name: api.name,
          label: `${api.name}${api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : ''}`,
          desc: [/^\d/.test(api.version) ? `v${api.version}` : api.version].filter(Boolean).join(', '),
          statusLabel: api.id == appSetting['common.apiSource'] ? `[${getApiStatus()}]` : '',
          status: api.status,
          message: api.message,
          disabled: false,
        })),
      ]
    })

    const sourceNameTypes = computed(() => {
      return [
        { id: 'real', label: t('setting__basic_sourcename_real') },
        { id: 'alias', label: t('setting__basic_sourcename_alias') },
      ]
    })

    const systemFontList = ref([])
    const fontList = computed(() => [{ id: '', label: t('setting__desktop_lyric_font_default') }, ...systemFontList.value])
    void getSystemFonts().then(fonts => {
      systemFontList.value = fonts.map(f => ({ id: f, label: f.replace(/(^"|"$)/g, '') }))
    })

    const fonts = computed(() => {
      if (!appSetting['common.font']) return ['', '']
      let [f1 = '', f2 = ''] = appSetting['common.font'].split(',')
      return [f1.trim(), f2.trim()]
    })
    const updateFonts = (font1, font2) => {
      const font = []
      if (font1) font.push(font1)
      if (font2) font.push(font2)
      updateSetting({ 'common.font': font.join(', ') })
    }
    const fontSizeList = computed(() => {
      return [
        { id: 14, label: t('setting__basic_font_size_14px') },
        { id: 15, label: t('setting__basic_font_size_15px') },
        { id: 16, label: t('setting__basic_font_size_16px') },
        { id: 17, label: t('setting__basic_font_size_17px') },
        { id: 18, label: t('setting__basic_font_size_18px') },
        { id: 19, label: t('setting__basic_font_size_19px') },
      ]
    })

    return {
      appSetting,
      updateSetting,
      themeList,
      selectedThemeCardId,
      typedThemeColor,
      typedThemeColorNormalized,
      themePreviewColor,
      themePreviewHexColor,
      applyTypedTheme,
      handlePickThemeColor,
      createEmptyTheme,
      fonts,
      updateFonts,
      isShowPlayTimeoutModal,
      timeLabel,
      apiSources,
      isShowUserApiModal,
      windowSizeList,
      langList,
      sourceNameTypes,
      fontList,
      isFullscreen,
      toggleTheme,
      handleThemeContextMenu,
      fontSizeList,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.theme {
  display: flex;
  flex-flow: row wrap;
  gap: 12px;
  margin: 16px 0 0;

  .themeItem {
    display: flex;
    flex-flow: column nowrap;
    align-items: center;
    cursor: pointer;
    transition: .3s ease;
    transition-property: color, opacity, box-shadow;
    width: 92px;
    padding: 10px 10px 6px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.48);
    border: 1px solid rgba(255, 255, 255, 0.5);

    &:hover {
      opacity: .7;
    }

    &.active {
      color: var(--color-primary-font-active);
      opacity: 1;
      box-shadow: 0 12px 30px color-mix(in srgb, var(--color-primary) 16%, transparent);

      .bg {
        border-color: var(--color-primary-font-active);
      }

      &:hover {
        opacity: 1;
      }
    }

    .bg {
      display: block;
      width: 44px;
      height: 44px;
      margin-bottom: 8px;
      border: 2px solid transparent;
      padding: 3px;
      transition: border-color .3s ease;
      border-radius: 12px;

      &:after {
        display: block;
        content: ' ';
        width: 100%;
        height: 100%;
        border-radius: 9px;
        background-color: var(--color-primary-theme);
      }
    }

    .label {
      width: 100%;
      text-align: center;
      min-height: 1.2em;
      font-size: 12px;
      line-height: 1.2;
      word-break: break-all;
    }
  }
}

.themeComposer {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.themePreview {
  position: relative;
  width: 42px;
  height: 42px;
  flex: none;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: var(--theme-preview);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.38);
  overflow: hidden;
  cursor: pointer;
}

.themePicker {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
  background: transparent;
}

.themeInput {
  max-width: 220px;
}

.themeAdd {
  justify-content: center;

  .bg:after {
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(226, 232, 244, 0.9));
  }

  .label {
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }
}

.themeDraft {
  .bg {
    border-style: dashed;
    border-color: rgba(121, 136, 164, 0.34);

    &:after {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(226, 232, 244, 0.82));
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.62);
    }
  }
}

.sourceLabel {
  flex: auto;
  margin-left: 5px;
  line-height: 1.5;
  cursor: pointer;

  .desc {
    color: var(--color-500);
    font-size: 12px;
    margin-left: 5px;
  }

  .status {
    margin-left: 5px;
  }
}
</style>
