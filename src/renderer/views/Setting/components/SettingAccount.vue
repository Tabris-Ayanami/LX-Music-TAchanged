<template lang="pug">
dt#account {{ $t('setting__account') }}
dd
  div(:class="$style.accountShell")
    div(:class="$style.nowPlaying")
      button(
        v-for="tab in accountTabs"
        :key="tab.id"
        type="button"
        :class="[$style.npTab, { [$style.expanded]: activeAccountTab == tab.id }]"
        :style="{ '--account-tab-color': tab.color }"
        :aria-pressed="activeAccountTab == tab.id"
        @click="activeAccountTab = tab.id"
      )
        span(v-if="activeAccountTab == tab.id" :class="$style.npMeta")
          strong {{ tab.name }}
          span(:class="$style.npStatus") {{ tab.status }}
        span(:class="$style.npIconWrap")
          img(:class="$style.npIcon" :src="tab.icon" alt="")
    div(:class="$style.accountPanels")
      section(v-if="activeAccountTab == 'bili'" :class="$style.accountPanel")
        h3#account_bili {{ $t('setting__account_bili') }}
        div
          .p.small {{ biliStatus }}
          .p
            textarea.scroll(
              :class="$style.cookieInput"
              :value="biliCookie"
              :placeholder="$t('setting__account_bili_cookie_placeholder')"
              @input="setBiliCookieInput"
            )
          .p
            base-btn.btn(min :disabled="saving" @click="saveBiliCookie") {{ $t('setting__account_save') }}
            base-btn.btn.gap-left(min :disabled="testing" @click="testBiliCookie") {{ $t('setting__account_test') }}
            base-btn.btn.gap-left(min :disabled="!appSetting['account.bili.cookie']" @click="clearBiliCookie") {{ $t('setting__account_clear') }}
      section(v-else :class="$style.accountPanel")
        h3#account_wy {{ $t('setting__account_wy') }}
        div
          .p.small {{ wyStatus }}
          .p
            base-btn.btn(min @click="openWyQrLogin") {{ $t('setting__account_wy_qr_login') }}
          .p
            textarea.scroll(
              :class="$style.cookieInput"
              :value="wyCookie"
              :placeholder="$t('setting__account_wy_cookie_placeholder')"
              @input="setWyCookieInput"
            )
          .p.small {{ $t('setting__account_wy_tip') }}
          .p
            base-btn.btn(min :disabled="wySaving" @click="saveWyCookie") {{ $t('setting__account_save') }}
            base-btn.btn.gap-left(min :disabled="wyTesting" @click="testWyCookie") {{ $t('setting__account_test') }}
            base-btn.btn.gap-left(min :disabled="!appSetting['account.wy.cookie']" @click="clearWyCookie") {{ $t('setting__account_clear') }}

material-modal(
  :show="wyQrShow"
  bg-close
  teleport="#view"
  width="380px"
  max-width="calc(100vw - 48px)"
  @close="closeWyQrLogin"
)
  div(:class="$style.qrPanel")
    h3 {{ $t('setting__account_wy_qr_login') }}
    p {{ $t('setting__account_wy_qr_tip') }}
    div(:class="$style.qrBox")
      img(v-if="wyQrImg" :class="$style.qrImage" :src="wyQrImg" alt="")
      div(v-else :class="$style.qrPlaceholder")
        span {{ wyQrText }}
    p(:class="$style.qrStatus") {{ wyQrText }}
    .p
      base-btn.btn(min @click="refreshWyQrLogin") {{ $t('setting__account_wy_qr_refresh') }}

</template>

<script>
import { onDeactivated } from 'vue'
import { computed, onBeforeUnmount, ref } from '@common/utils/vueTools'
import { appSetting, mergeSetting, updateSetting } from '@renderer/store/setting'
import { clearBiliAccount, getBiliAccount, setBiliCookie } from '@renderer/utils/ipc'
import music from '@renderer/utils/musicSdk'
import wyAccountIcon from '@static/images/account/wy.png'
import biliAccountIcon from '@static/images/account/bili.jpg'

const syncSetting = (key, value) => {
  mergeSetting({ [key]: value })
  updateSetting({ [key]: value })
}

export default {
  name: 'SettingAccount',
  setup() {
    // B站
    const biliCookie = ref(appSetting['account.bili.cookie'])
    const biliStatus = ref(appSetting['account.bili.cookie'] ? window.i18n.t('setting__account_saved') : window.i18n.t('setting__account_not_set'))
    const saving = ref(false)
    const testing = ref(false)

    const setBiliCookieInput = event => {
      biliCookie.value = event.target.value.trim()
    }

    const formatBiliStatus = info => {
      if (!info.hasCookie) return window.i18n.t('setting__account_not_set')
      return info.isLogin
        ? window.i18n.t('setting__account_bili_login_success', { name: info.uname || info.mid || '' })
        : window.i18n.t('setting__account_bili_login_failed')
    }

    const saveBiliCookie = async() => {
      saving.value = true
      try {
        const info = await setBiliCookie(biliCookie.value)
        syncSetting('account.bili.cookie', biliCookie.value)
        biliStatus.value = formatBiliStatus(info)
      } catch (err) {
        console.log(err)
        biliStatus.value = window.i18n.t('setting__account_bili_test_failed')
      } finally {
        saving.value = false
      }
    }

    const clearBiliCookie = async() => {
      saving.value = true
      try {
        await clearBiliAccount()
        biliCookie.value = ''
        syncSetting('account.bili.cookie', '')
        biliStatus.value = window.i18n.t('setting__account_not_set')
      } finally {
        saving.value = false
      }
    }

    const testBiliCookie = async() => {
      testing.value = true
      try {
        if (biliCookie.value != appSetting['account.bili.cookie']) {
          const info = await setBiliCookie(biliCookie.value)
          syncSetting('account.bili.cookie', biliCookie.value)
          biliStatus.value = formatBiliStatus(info)
          return
        }
        const info = await getBiliAccount()
        biliStatus.value = formatBiliStatus(info)
      } catch (err) {
        console.log(err)
        biliStatus.value = window.i18n.t('setting__account_bili_test_failed')
      } finally {
        testing.value = false
      }
    }

    // 网易云
    const wyCookie = ref(appSetting['account.wy.cookie'])
    const wyStatus = ref(appSetting['account.wy.cookie'] ? window.i18n.t('setting__account_saved') : window.i18n.t('setting__account_not_set'))
    const wySaving = ref(false)
    const wyTesting = ref(false)
    const wyQrShow = ref(false)
    const wyQrImg = ref('')
    const wyQrText = ref('')
    let wyQrTimer = null
    let wyQrGeneration = 0
    const isWyQrCurrent = generation => wyQrShow.value && generation == wyQrGeneration
    const activeAccountTab = ref('wy')
    const accountTabs = computed(() => [
      {
        id: 'wy',
        name: window.i18n.t('setting__account_wy'),
        status: wyStatus.value,
        color: '#c20c0c',
        icon: wyAccountIcon,
      },
      {
        id: 'bili',
        name: window.i18n.t('setting__account_bili'),
        status: biliStatus.value,
        color: '#00a1d6',
        icon: biliAccountIcon,
      },
    ])

    const setWyCookieInput = event => {
      wyCookie.value = event.target.value.trim()
    }

    const formatWyStatus = info => {
      if (!info.hasCookie) return window.i18n.t('setting__account_not_set')
      return info.isLogin
        ? window.i18n.t('setting__account_wy_login_success', { name: info.nickname || info.userId || '' })
        : window.i18n.t('setting__account_wy_login_failed')
    }

    const stopWyQrTimer = () => {
      if (!wyQrTimer) return
      clearTimeout(wyQrTimer)
      wyQrTimer = null
    }

    const setWyQrError = message => {
      stopWyQrTimer()
      wyQrImg.value = ''
      wyQrText.value = message || window.i18n.t('setting__account_wy_test_failed')
    }

    const pollWyQrLogin = async(unikey, generation) => {
      if (!isWyQrCurrent(generation)) return
      stopWyQrTimer()
      let result
      try {
        result = await music.wy.account.checkQrLogin(unikey)
      } catch (err) {
        if (!isWyQrCurrent(generation)) return
        console.warn(err)
        wyQrText.value = window.i18n.t('setting__account_wy_test_failed')
        return
      }
      if (!isWyQrCurrent(generation)) return
      if (result.code == 803) {
        if (!result.cookie) {
          console.warn('[wy] qr login succeeded but cookie is empty')
          wyQrText.value = window.i18n.t('setting__account_wy_test_failed')
          return
        }
        wyCookie.value = result.cookie
        syncSetting('account.wy.cookie', result.cookie)
        const info = await music.wy.account.getAccountInfo()
        if (!isWyQrCurrent(generation)) return
        wyStatus.value = formatWyStatus(info)
        wyQrText.value = window.i18n.t('setting__account_wy_qr_success')
        wyQrImg.value = ''
        wyQrShow.value = false
        return
      }
      if (result.code == 802) {
        wyQrText.value = window.i18n.t('setting__account_wy_qr_confirming')
      } else if (result.code == 801) {
        wyQrText.value = window.i18n.t('setting__account_wy_qr_waiting')
      } else if (result.code == 800) {
        setWyQrError(window.i18n.t('setting__account_wy_qr_expired'))
        return
      } else {
        console.warn('[wy] qr login check failed with code', result.code, result.message)
        wyQrText.value = result.message || window.i18n.t('setting__account_wy_test_failed')
        return
      }
      wyQrTimer = setTimeout(() => {
        void pollWyQrLogin(unikey, generation)
      }, 2000)
    }

    const refreshWyQrLogin = async() => {
      const generation = ++wyQrGeneration
      stopWyQrTimer()
      if (!wyQrShow.value) return
      wyQrImg.value = ''
      wyQrText.value = ''
      try {
        const info = await music.wy.account.createQrLogin()
        if (!isWyQrCurrent(generation)) return
        wyQrImg.value = info.qrimg
        wyQrText.value = window.i18n.t('setting__account_wy_qr_waiting')
        await pollWyQrLogin(info.unikey, generation)
      } catch (err) {
        if (!isWyQrCurrent(generation)) return
        console.log(err)
        setWyQrError(window.i18n.t('setting__account_wy_test_failed'))
      }
    }

    const openWyQrLogin = () => {
      wyQrShow.value = true
      void refreshWyQrLogin()
    }

    const closeWyQrLogin = () => {
      ++wyQrGeneration
      stopWyQrTimer()
      wyQrShow.value = false
      wyQrImg.value = ''
      wyQrText.value = ''
    }

    const saveWyCookie = async() => {
      wySaving.value = true
      try {
        syncSetting('account.wy.cookie', wyCookie.value)
        const info = await music.wy.account.getAccountInfo()
        wyStatus.value = formatWyStatus(info)
      } catch (err) {
        console.log(err)
        wyStatus.value = window.i18n.t('setting__account_wy_test_failed')
      } finally {
        wySaving.value = false
      }
    }

    const clearWyCookie = async() => {
      wySaving.value = true
      try {
        wyCookie.value = ''
        syncSetting('account.wy.cookie', '')
        wyStatus.value = window.i18n.t('setting__account_not_set')
      } finally {
        wySaving.value = false
      }
    }

    const testWyCookie = async() => {
      wyTesting.value = true
      try {
        if (wyCookie.value != appSetting['account.wy.cookie']) {
          syncSetting('account.wy.cookie', wyCookie.value)
        }
        const info = await music.wy.account.getAccountInfo()
        wyStatus.value = formatWyStatus(info)
      } catch (err) {
        console.log(err)
        wyStatus.value = window.i18n.t('setting__account_wy_test_failed')
      } finally {
        wyTesting.value = false
      }
    }

    onBeforeUnmount(closeWyQrLogin)
    onDeactivated(closeWyQrLogin)

    return {
      appSetting,
      activeAccountTab,
      accountTabs,
      biliCookie,
      biliStatus,
      saving,
      testing,
      setBiliCookieInput,
      saveBiliCookie,
      clearBiliCookie,
      testBiliCookie,
      wyCookie,
      wyStatus,
      wySaving,
      wyTesting,
      wyQrShow,
      wyQrImg,
      wyQrText,
      setWyCookieInput,
      saveWyCookie,
      clearWyCookie,
      testWyCookie,
      openWyQrLogin,
      refreshWyQrLogin,
      closeWyQrLogin,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.accountShell {
  width: min(720px, 100%);
}

.nowPlaying {
  display: flex;
  align-items: stretch;
  gap: 10px;
  margin-bottom: 16px;
  height: 48px;
}

.npTab {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 52px;
  width: 52px;
  min-width: 52px;
  height: 48px;
  padding: 0 8px;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  color: #fff;
  cursor: pointer;
  background: color-mix(in srgb, var(--account-tab-color) 24%, transparent);
  box-shadow:
    0 12px 30px rgba(20, 28, 44, .18),
    inset 0 1px 0 rgba(255, 255, 255, .14);
  text-shadow: 0 1px 3px rgba(0, 0, 0, .3);
  transition:
    flex-basis .45s var(--motion-ease-out),
    width .45s var(--motion-ease-out),
    min-width .45s var(--motion-ease-out),
    background-color .2s ease;

  &:hover {
    background-color: color-mix(in srgb, var(--account-tab-color) 34%, transparent);
  }

  &.expanded {
    flex: 1 1 auto;
    width: auto;
    min-width: 240px;
    justify-content: flex-start;
    background-color: var(--account-tab-color);
  }
}

.npMeta {
  display: flex;
  flex: 1;
  min-width: 0;
  align-items: center;
  gap: 8px;
  order: 1;
  transition: opacity .3s ease .08s, transform .35s var(--motion-ease-out) .08s;

  strong {
    flex: none;
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }
}

.npStatus {
  flex: 1;
  min-width: 0;
  color: rgba(255, 255, 255, .84);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.npIconWrap {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  overflow: hidden;
  background: rgba(255, 255, 255, .16);
  order: 2;
}

.npTab.expanded .npIconWrap {
  margin-left: auto;
}

.npIcon {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.accountPanel {
  padding-top: 2px;
}

.cookieInput {
  box-sizing: border-box;
  width: min(620px, 100%);
  min-height: 96px;
  border: none;
  border-radius: @form-radius;
  padding: 8px 10px;
  color: var(--color-button-font);
  outline: none;
  resize: vertical;
  transition: background-color 0.2s ease;
  background-color: var(--color-primary-background);
  font-size: 13px;
  line-height: 1.5;

  &:hover,
  &:focus {
    background-color: var(--color-primary-background-hover);
  }
}

.qrPanel {
  padding: 8px 4px;
  text-align: center;

  h3 {
    margin: 0 0 8px;
    font-size: 16px;
  }

  p {
    margin: 8px 0;
    color: var(--color-font-label);
    font-size: 13px;
  }
}

.qrBox {
  width: 230px;
  height: 230px;
  margin: 12px auto;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(255, 255, 255, .05);
}

.qrImage {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.qrPlaceholder {
  color: var(--color-font-label);
  font-size: 13px;
}

.qrStatus {
  min-height: 20px;
}
</style>
