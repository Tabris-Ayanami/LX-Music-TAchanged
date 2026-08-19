<template lang="pug">
dt#account {{ $t('setting__account') }}
dd
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

dd.gap-top
  h3#account_wy {{ $t('setting__account_wy') }}
  div
    .p.small {{ wyStatus }}
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

</template>

<script>
import { ref } from '@common/utils/vueTools'
import { appSetting, mergeSetting, updateSetting } from '@renderer/store/setting'
import { clearBiliAccount, getBiliAccount, setBiliCookie } from '@renderer/utils/ipc'
import music from '@renderer/utils/musicSdk'

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

    const setWyCookieInput = event => {
      wyCookie.value = event.target.value.trim()
    }

    const formatWyStatus = info => {
      if (!info.hasCookie) return window.i18n.t('setting__account_not_set')
      return info.isLogin
        ? window.i18n.t('setting__account_wy_login_success', { name: info.nickname || info.userId || '' })
        : window.i18n.t('setting__account_wy_login_failed')
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

    return {
      appSetting,
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
      setWyCookieInput,
      saveWyCookie,
      clearWyCookie,
      testWyCookie,
    }
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

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
</style>
