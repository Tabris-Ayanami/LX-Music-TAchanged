<template>
  <Modal :show="visible" :close-btn="false" :teleport="teleport" @close="handleCancel" @after-leave="afterLeave">
    <main class="scroll" :class="[$style.main, { 'select': selection }]">{{ message }}</main>
    <label v-if="selectionText" :class="$style.selection" @click.prevent="selectionChecked = !selectionChecked">
      <span :class="[$style.checkbox, { [$style.checkboxChecked]: selectionChecked }]" aria-hidden="true">
        <svg v-if="selectionChecked" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 448" space="preserve">
          <use xlink:href="#icon-check-true" />
        </svg>
      </span>
      <span :class="$style.selectionText">{{ selectionText }}</span>
    </label>
    <footer :class="$style.footer">
      <Btn v-if="showCancel" :class="$style.btn" @click="handleCancel">{{ cancelBtnText }}</Btn>
      <Btn :class="$style.btn" @click="handleComfirm">{{ confirmBtnText }}</Btn>
    </footer>
  </Modal>
</template>

<script>
import Modal from '@renderer/components/material/Modal.vue'
import Btn from '@renderer/components/base/Btn.vue'
import { useI18n } from '@renderer/plugins/i18n'
import { computed } from '@common/utils/vueTools'
export default {
  components: {
    Modal,
    Btn,
  },
  props: {
    afterLeave: {
      type: Function,
      default: () => {},
    },
  },
  setup() {
    const t = useI18n()

    const defaultBtnTexts = computed(() => {
      return {
        confirm: t('confirm_button_text'),
        cancel: t('cancel_button_text'),
      }
    })

    return {
      defaultBtnTexts,
    }
  },
  data() {
    return {
      visible: false,
      message: '',
      showCancel: false,
      cancelButtonText: '',
      confirmButtonText: '',
      teleport: '#root',
      selection: false,
      selectionText: '',
      selectionChecked: false,
    }
  },
  computed: {
    cancelBtnText() {
      return this.cancelButtonText || this.defaultBtnTexts.cancel
    },
    confirmBtnText() {
      return this.confirmButtonText || this.defaultBtnTexts.confirm
    },
  },
  beforeUnmount() {
    const el = this.$el
    el.parentNode.removeChild(el)
  },
  methods: {
    handleCancel() {
    },
    handleComfirm() {
    },
  },
}
</script>

<style lang="less" module>

.main {
  flex: auto;
  min-height: 40px;
  padding: 15px 15px 0;
  font-size: 14px;
  // max-width: 320px;
  min-width: 220px;
  line-height: 1.5;
  white-space: pre-line;
}

.footer {
  flex: none;
  padding: 15px;
  display: flex;
  flex-flow: row nowrap;
  justify-content: flex-end;
  gap: 15px;
}

.selection {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 15px 0;
  font-size: 13px;
  color: var(--shell-muted, var(--color-font-label));
  cursor: pointer;
  user-select: none;
}

.checkbox {
  flex: none;
  width: 15px;
  height: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid color-mix(in srgb, var(--shell-text, var(--color-font)) 32%, transparent);
  border-radius: 4px;
  color: #fff;

  svg {
    width: 11px;
    height: 11px;
  }
}

.checkboxChecked {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
