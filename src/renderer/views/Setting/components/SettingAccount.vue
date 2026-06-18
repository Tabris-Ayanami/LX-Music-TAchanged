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
  h3#account_placeholder {{ $t('setting__account_other') }}
  div
    .p.small {{ $t('setting__account_placeholder_tip') }}
    .p
      base-btn.btn(min disabled) {{ $t('source_wy') }}
      base-btn.btn.gap-left(min disabled) {{ $t('source_tx') }}
      base-btn.btn.gap-left(min disabled) {{ $t('source_kg') }}
</template>

<script>
import { ref } from '@common/utils/vueTools'
import { appSetting, mergeSetting, updateSetting } from '@renderer/store/setting'
import { clearBiliAccount, getBiliAccount, setBiliCookie } from '@renderer/utils/ipc'

export default {
  name: 'SettingAccount',
  setup() {
    const biliCookie = ref(appSetting['account.bili.cookie'])
    const biliStatus = ref(appSetting['account.bili.cookie'] ? window.i18n.t('setting__account_saved') : window.i18n.t('setting__account_not_set'))
    const saving = ref(false)
    const testing = ref(false)

    const setBiliCookieInput = event => {
      biliCookie.value = event.target.value.trim()
    }

    const syncBiliSetting = cookie => {
      mergeSetting({ 'account.bili.cookie': cookie })
      updateSetting({ 'account.bili.cookie': cookie })
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
        syncBiliSetting(biliCookie.value)
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
        syncBiliSetting('')
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
          syncBiliSetting(biliCookie.value)
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
