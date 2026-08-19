<template>
  <div :class="[$style.container, { [$style.smallContainer]: small }]">
    <!-- gooey 滤镜：仅作用在胶囊+圆球组合层，实现展开时的液态分离；下拉面板不受影响 -->
    <svg :class="$style.gooFilter" aria-hidden="true">
      <defs>
        <filter id="lx-search-goo">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -15" result="goo" />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </defs>
    </svg>

    <!-- 组合层：胶囊 + 圆球。折叠态只有胶囊（图标在胶囊内部右侧）；展开时圆球从胶囊右端液态分离 -->
    <div
      :class="[
        $style.goo,
        { [$style.active]: focus, [$style.expanded]: visibleList, [$style.collapsed]: !expanded, [$style.big]: big, [$style.small]: small },
      ]"
      @click="handleMainClick"
    >
      <!-- 胶囊型搜索框：折叠时是按钮，点击展开；展开后承载输入框 + 清空钮 -->
      <div
        :class="$style.main"
        role="button"
        :tabindex="expanded ? -1 : 0"
        :aria-expanded="expanded"
        @keydown.enter.prevent="handleMainClick"
        @keydown.space.prevent="handleMainClick"
      >
        <!-- 折叠态文案 -->
        <span v-show="!expanded" :class="$style.collapseLabel">{{ text || placeholder }}</span>

        <!-- 折叠态搜索图标：位于胶囊内部右侧，展开时淡出（分离给外部圆球） -->
        <transition name="icon-fade">
          <div v-show="!expanded" :class="$style.innerIcon" aria-hidden="true">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" viewBox="0 0 15 15" space="preserve">
              <path
                d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C13.0488 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </transition>

        <input
          ref="dom_input"
          v-model.trim="text"
          :class="$style.input"
          :placeholder="placeholder"
          :tabindex="expanded ? 0 : -1"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="$emit('update:modelValue', text)"
          @change="sendEvent('change')"
          @keyup.enter="handleSearch"
          @keydown.arrow-down.arrow-up.prevent
          @keyup.arrow-down.prevent="handleKeyDown"
          @keyup.arrow-up.prevent="handleKeyUp"
          @contextmenu="handleContextMenu"
        >
        <transition name="motion-pop">
          <button v-show="expanded && text" type="button" :class="$style.clearBtn" @click.stop="handleClearList">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 24 24" space="preserve">
              <use xlink:href="#icon-window-close" />
            </svg>
          </button>
        </transition>
      </div>

      <!-- 圆形搜索钮：折叠时贴合胶囊右端（不可见），展开时液态分离浮现；请求中显示旋转加载 -->
      <button
        type="button"
        :class="$style.searchBtn"
        :aria-label="placeholder"
        @click.stop="handleSearch"
      >
        <svg
          v-if="!isLoading"
          version="1.1"
          xmlns="http://www.w3.org/2000/svg"
          xlink="http://www.w3.org/1999/xlink"
          viewBox="0 0 15 15"
          space="preserve"
        >
          <path
            d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C13.0488 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
        <svg v-else :class="$style.loadingIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" aria-label="Loading" role="status">
          <rect width="256" height="256" fill="none" />
          <line x1="128" y1="32" x2="128" y2="64" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="195.88" y1="60.12" x2="173.25" y2="82.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="224" y1="128" x2="192" y2="128" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="195.88" y1="195.88" x2="173.25" y2="173.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="128" y1="224" x2="128" y2="192" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="60.12" y1="195.88" x2="82.75" y2="173.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="32" y1="128" x2="64" y2="128" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
          <line x1="60.12" y1="60.12" x2="82.75" y2="82.75" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="16" />
        </svg>
      </button>
    </div>

    <!-- 联想下拉：独立浮层面板，与搜索框同底色、四周描边，不受 gooey 滤镜影响 -->
    <transition name="goo-list">
      <div v-if="list.length && visibleList" :class="$style.list">
        <transition-group tag="ul" name="goo-item" :class="$style.listUl" @mouseleave="selectIndex = -1">
          <li
            v-for="(item, index) in list"
            :key="index + item"
            :class="{[$style.select]: selectIndex === index }"
            :style="{ transitionDelay: `${index * 45}ms` }"
            @mouseenter="selectIndex = index"
            @click="handleTemplistClick(index)"
          >
            <svg :class="$style.listInfo" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20.2832 19.9316" fill="none" aria-hidden="true">
              <path
                d="M7.49991 0.876892C3.84222 0.876892 0.877075 3.84204 0.877075 7.49972C0.877075 11.1574 3.84222 14.1226 7.49991 14.1226C11.1576 14.1226 14.1227 11.1574 14.1227 7.49972C14.1227 3.84204 11.1576 0.876892 7.49991 0.876892ZM1.82707 7.49972C1.82707 4.36671 4.36689 1.82689 7.49991 1.82689C10.6329 1.82689 13.1727 4.36671 13.1727 7.49972C13.1727 10.6327 10.6329 13.1726 7.49991 13.1726C4.36689 13.1726 1.82707 10.6327 1.82707 7.49972ZM8.24992 4.49999C8.24992 4.91420 7.91413 5.24999 7.49992 5.24999C7.08571 5.24999 6.74992 4.91420 6.74992 4.49999C6.74992 4.08577 7.08571 3.74999 7.49992 3.74999C7.91413 3.74999 8.24992 4.08577 8.24992 4.49999ZM6.00003 5.99999H6.50003H7.50003C7.77618 5.99999 8.00003 6.22384 8.00003 6.49999V9.99999H8.50003H9.00003V11H8.50003H7.50003H6.50003H6.00003V9.99999H6.50003H7.00003V6.99999H6.50003H6.00003V5.99999Z"
                fill="currentColor"
                fillRule="evenodd"
                clipRule="evenodd"
              />
            </svg>
            <span>{{ item }}</span>
          </li>
        </transition-group>
      </div>
    </transition>
  </div>
</template>

<script>
import { clipboardReadText } from '@common/utils/electron'
import { HOTKEY_COMMON } from '@common/hotKey'
import { appSetting } from '@renderer/store/setting'

export default {
  props: {
    placeholder: {
      type: String,
      default: 'Search for something...',
    },
    list: {
      type: Array,
      default() {
        return []
      },
    },
    visibleList: {
      type: Boolean,
      default: false,
    },
    modelValue: {
      type: String,
      default: '',
    },
    isLoading: {
      type: Boolean,
      default: false,
    },
    big: {
      type: Boolean,
      default: false,
    },
    small: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['update:modelValue', 'event'],
  data() {
    return {
      text: '',
      selectIndex: -1,
      focus: false,
      expanded: false,
      blurTimer: null,
    }
  },
  watch: {
    list() {
      if (this.selectIndex > -1) this.selectIndex = -1
    },
    modelValue(n) {
      this.text = n
    },
  },
  mounted() {
    if (appSetting['search.isFocusSearchBox']) this.handleExpandFocus()
    this.handleRegisterEvent('on')
  },
  beforeUnmount() {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer)
      this.blurTimer = null
    }
    this.handleRegisterEvent('off')
  },
  methods: {
    handleRegisterEvent(action) {
      let eventHub = window.key_event
      let name = action == 'on' ? 'on' : 'off'
      // eslint-disable-next-line @typescript-eslint/unbound-method
      eventHub[name](HOTKEY_COMMON.focusSearchInput.action, this.handleFocusInput)
    },
    // 快捷键聚焦：先展开胶囊，再聚焦输入框
    handleFocusInput() {
      this.handleExpandFocus()
    },
    handleExpandFocus() {
      this.expanded = true
      this.$nextTick(() => {
        this.$refs.dom_input?.focus()
      })
    },
    // 折叠组合层点击：展开并聚焦；已展开时点击空白区聚焦输入框
    handleMainClick() {
      if (!this.expanded) {
        this.handleExpandFocus()
        return
      }
      this.$refs.dom_input?.focus()
    },
    handleTemplistClick(index) {
      this.sendEvent('listClick', index)
    },
    handleFocus() {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer)
        this.blurTimer = null
      }
      this.expanded = true
      this.focus = true
      this.sendEvent('focus')
    },
    handleBlur() {
      if (this.blurTimer) clearTimeout(this.blurTimer)
      this.blurTimer = setTimeout(() => {
        this.blurTimer = null
        this.focus = false
        this.expanded = false
        this.sendEvent('blur')
      }, 120)
    },
    handleSearch() {
      if (this.selectIndex < 0) {
        this.sendEvent('submit')
        return
      }
      this.sendEvent('listClick', this.selectIndex)
    },
    sendEvent(action, data) {
      this.$emit('event', { action, data })
    },
    handleKeyDown() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex + 1 < this.list.length ? this.selectIndex + 1 : 0
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleKeyUp() {
      if (this.list.length) {
        this.selectIndex = this.selectIndex - 1 < -1 ? this.list.length - 1 : this.selectIndex - 1
      } else if (this.selectIndex > -1) {
        this.selectIndex = -1
      }
    },
    handleContextMenu() {
      let str = clipboardReadText()
      str = str.trim()
      str = str.replace(/\t|\r\n|\n|\r/g, ' ')
      str = str.replace(/\s+/g, ' ')
      let dom_input = this.$refs.dom_input
      this.text = this.text.substring(0, dom_input.selectionStart) + str + this.text.substring(dom_input.selectionEnd, this.text.length)
      this.$emit('update:modelValue', this.text)
    },
    handleClearList() {
      this.text = ''
      this.$emit('update:modelValue', this.text)
      this.sendEvent('submit')
    },
  },
}
</script>

<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

/* ========== 尺寸 ========== */
/* small（顶栏）：整体高 43px，胶囊 43px，圆球 38px，展开间距 16px，折叠宽 150px */
/* 默认：整体高 50px，胶囊 50px，圆球 46px，展开间距 18px，折叠宽 170px */

.container {
  position: relative;
  width: 100%;
  max-width: none;
  height: 50px;
  -webkit-app-region: no-drag;
}

.smallContainer {
  height: 43px;
}

.gooFilter {
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
}

/* ===== gooey 组合层：胶囊 + 圆球 ===== */
.goo {
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  gap: 0;
  width: 170px;
  cursor: pointer;
  transition: width .5s var(--motion-ease-out), gap .5s var(--motion-ease-out);
  filter: url(#lx-search-goo);

  /* 展开：胶囊撑满容器，圆球液态分离到右侧 */
  &:not(.collapsed) {
    width: 100%;
    gap: 18px;
    cursor: auto;
  }
}

/* ===== 胶囊型搜索框 ===== */
.main {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 50px;
  display: flex;
  align-items: center;
  background: var(--shell-surface-strong, rgba(255, 255, 255, .95));
  border: 1px solid var(--shell-divider, color-mix(in srgb, var(--shell-text, #182236) 18%, transparent));
  border-radius: 25px;
  overflow: hidden;
  /* 内凹（sunken）：顶部内侧暗影 + 底部内侧高光，使搜索框像嵌进顶栏表面 */
  box-shadow:
    inset 0 2px 5px color-mix(in srgb, var(--shell-text, #182236) 16%, transparent),
    inset 0 -1px 1px rgba(255, 255, 255, .75),
    0 1px 0 rgba(255, 255, 255, .35);
  transition: border-color var(--motion-duration-fast) var(--motion-ease-out), box-shadow var(--motion-duration-normal) var(--motion-ease-out), background-color var(--motion-duration-normal) var(--motion-ease-out);
}

/* 折叠态文案 */
.collapseLabel {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  padding: 0 18px;
  padding-right: 44px; /* 给右侧图标留位 */
  font-size: 14px;
  color: var(--shell-muted, var(--color-button-font));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

/* 折叠态内部搜索图标：胶囊内部右侧 */
.innerIcon {
  position: absolute;
  right: 14px;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  color: var(--shell-muted, var(--color-button-font));
  transition: opacity .2s ease, transform .2s ease;
  pointer-events: none;

  svg {
    width: 15px;
    height: 15px;
  }
}

/* 展开时内部图标淡出，让位给外部圆球 */
.goo:not(.collapsed) .innerIcon {
  opacity: 0;
  transform: scale(.5);
}

.input {
  flex: auto;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  padding: 0 14px;
  font-size: 14px;
  color: var(--shell-text, var(--color-font));
  opacity: 0;
  pointer-events: none;
  transition: opacity .25s ease .08s;

  &::placeholder {
    color: var(--shell-muted, var(--color-button-font));
  }
}

/* 展开态：输入框可用 */
.goo:not(.collapsed) {
  .input {
    opacity: 1;
    pointer-events: auto;
  }
}

.clearBtn {
  flex: none;
  border: none;
  background: transparent;
  outline: none;
  cursor: pointer;
  height: 100%;
  padding: 0 12px;
  color: var(--shell-muted, var(--color-button-font));
  transition: color .2s ease;

  svg {
    width: 14px;
    height: 14px;
  }

  &:hover {
    color: var(--color-primary-font-hover);
  }
}

/* ===== 圆形搜索钮：折叠时藏于胶囊内部右端，展开时从胶囊内滑出 + 液态分离 ===== */
.searchBtn {
  position: relative;
  flex: none;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  background: linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 78%, #0b6e4a 22%));
  color: #fff;
  box-shadow:
    0 6px 16px var(--color-primary-alpha-600),
    inset 0 1px 0 rgba(255, 255, 255, .4),
    inset 0 -1px 2px rgba(0, 0, 0, .12);
  /* 折叠：球藏在胶囊右端内侧（向左偏移），快速显形后随 translateX/gap 滑出分离 */
  transform: translateX(-58px) scale(.4);
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s ease, transform .55s var(--motion-ease-out);

  svg {
    flex: none;
    width: 19px;
    height: 19px;
  }
}

.goo:not(.collapsed) .searchBtn {
  transform: translateX(0) scale(1);
  opacity: 1;
  pointer-events: auto;
}

.searchBtn:hover {
  box-shadow:
    0 8px 22px var(--color-primary-alpha-600),
    inset 0 1px 0 rgba(255, 255, 255, .45),
    inset 0 -1px 2px rgba(0, 0, 0, .12);
  transform: translateX(0) scale(1.06);
}
.searchBtn:active {
  transform: translateX(0) scale(.92);
}

.loadingIcon {
  animation: lx-search-spin .8s linear infinite;
  stroke: currentColor;
}

@keyframes lx-search-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== 联想下拉：独立浮层面板 ===== */
.list {
  position: absolute;
  left: 0;
  top: 60px;
  width: calc(100% - 64px); /* 胶囊宽 = 容器 - 圆球46 - 间距18 */
  z-index: 10;
  border-radius: 16px;
  background: var(--search-panel-bg, rgba(252, 253, 255, .98));
  border: 1px solid var(--shell-divider, rgba(73, 92, 122, .22));
  box-shadow:
    0 18px 44px rgba(20, 29, 46, .16),
    0 2px 8px rgba(20, 29, 46, .06),
    inset 0 1px 0 rgba(255, 255, 255, .6);
  overflow: hidden;
  padding: 6px;

  .listUl {
    margin: 0;
    padding: 0 0 6px;
    list-style: none;

    li {
      display: flex;
      align-items: center;
      gap: 9px;
      cursor: pointer;
      padding: 11px 14px;
      line-height: 1.35;
      border-radius: 10px;

      span {
        .mixin-ellipsis-1();
      }

      &.select,
      &:hover {
        background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
      }
      &:last-child {
        border-radius: 10px;
      }
    }
  }
}

.listInfo {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--shell-muted, var(--color-button-font));
  opacity: .85;
}

/* 联想项：每次结果更新，从底部 blur 级联浮现（framer-motion 风格） */
:global(.goo-item-enter-active) {
  transition:
    opacity .4s var(--motion-ease-out),
    transform .4s var(--motion-ease-out),
    filter .4s ease;
}
:global(.goo-item-enter-from) {
  opacity: 0;
  transform: translateY(10px) scale(.96);
  filter: blur(6px);
}
:global(.goo-item-leave-active) {
  transition: opacity .15s ease, transform .15s ease;
}
:global(.goo-item-leave-to) {
  opacity: 0;
  transform: translateY(-4px) scale(.96);
}

/* 聚焦指示：凹陷加深 + 淡主色描边，不使用主色外发光（避免 gooey 下的竖线 artifact） */
.goo.active .main,
.goo.expanded .main {
  border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 42%, transparent);
  box-shadow:
    inset 0 3px 7px color-mix(in srgb, var(--shell-text, #182236) 22%, transparent),
    inset 0 -1px 1px rgba(255, 255, 255, .7),
    0 1px 0 rgba(255, 255, 255, .35);
}

/* 下拉整体过渡 */
:global(.goo-list-enter-active),
:global(.goo-list-leave-active) {
  transition: opacity .22s var(--motion-ease-out), transform .22s var(--motion-ease-out);
}
:global(.goo-list-enter-from),
:global(.goo-list-leave-to) {
  opacity: 0;
  transform: translateY(-6px) scale(.99);
}

/* ===== 尺寸变体：small（顶栏） ===== */
.small {
  &.goo.collapsed {
    width: 150px;
  }

  &.goo:not(.collapsed) {
    gap: 16px;
  }

  & .main {
    height: 43px;
  }

  .main {
    border-radius: 21.5px;
  }

  .collapseLabel {
    font-size: 13px;
    padding: 0 16px;
    padding-right: 42px;
  }

  .innerIcon {
    right: 13px;

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .input {
    font-size: 13px;
    padding: 0 12px;
  }

  .searchBtn {
    width: 38px;
    height: 38px;

    svg {
      width: 17px;
      height: 17px;
    }
  }

  .list {
    top: 49px;
    width: calc(100% - 54px); /* 胶囊宽 = 容器 - 圆球38 - 间距16 */

    li {
      padding: 10px 12px;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .goo,
  .main,
  .searchBtn,
  .innerIcon,
  .list,
  .list::before,
  .list ul,
  .list li {
    transition-duration: 0.01ms !important;
    transition-delay: 0ms !important;
  }

  .loadingIcon {
    animation: none;
  }
}

.big {
  width: 100%;
}

/* ===== 深色模式：冷炭底色，主色描边 ===== */
:global(.themeShellDark) {
  .main {
    background: var(--shell-surface-strong, rgba(37, 42, 52, .95));
    border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 24%, rgba(255, 255, 255, .16));
    /* 深色下内凹：顶部更深暗影 + 底部极微弱高光 */
    box-shadow:
      inset 0 2px 5px rgba(0, 0, 0, .4),
      inset 0 -1px 1px rgba(255, 255, 255, .05);
  }

  .list {
    background: var(--search-panel-bg, rgba(33, 38, 48, .98));
    border-color: rgba(255, 255, 255, .09);
    box-shadow:
      0 20px 52px rgba(0, 0, 0, .42),
      0 2px 8px rgba(0, 0, 0, .22),
      inset 0 1px 0 rgba(255, 255, 255, .07);
  }

  .goo.active .main,
  .goo.expanded .main {
    border-color: color-mix(in srgb, var(--shell-accent, var(--color-primary)) 52%, rgba(255, 255, 255, .12));
    box-shadow:
      inset 0 3px 7px rgba(0, 0, 0, .5),
      inset 0 -1px 1px rgba(255, 255, 255, .05);
  }

  .searchBtn {
    box-shadow:
      0 6px 18px color-mix(in srgb, var(--color-primary) 40%, rgba(0, 0, 0, .4)),
      inset 0 1px 0 rgba(255, 255, 255, .35),
      inset 0 -1px 2px rgba(0, 0, 0, .3);
  }
}
</style>
