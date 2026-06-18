<template>
  <div v-if="maxPage > 1" :class="$style.pagination">
    <ul>
      <li v-if="page == 1" :class="$style.disabled">
        <span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-left" />
          </svg>
        </span>
      </li>
      <li v-else>
        <button type="button" :aria-label="$t('pagination__prev')" @click="handleClick(page - 1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-left" />
          </svg>
        </button>
      </li>
      <li v-if="maxPage > btnLength && page > pageEvg+1" :class="$style.first">
        <button type="button" :aria-label="$t('pagination__page', { num: 1 })" @click="handleClick(1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-first" />
          </svg>
        </button>
      </li>
      <li v-for="p in pages" :key="p" :class="{[$style.active] : p == page}">
        <span v-if="p === page" v-text="page" />
        <button v-else type="button" :aria-label="$t('pagination__page', { num: p })" @click="handleClick(p)" v-text="p" />
      </li>
      <li v-if="maxPage > btnLength && maxPage - page > pageEvg" :class="$style.last">
        <button type="button" :aria-label="$t('pagination__page', { num: maxPage })" @click="handleClick(maxPage)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-last" />
          </svg>
        </button>
      </li>
      <li v-if="page == maxPage" :class="$style.disabled">
        <span>
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg></span>
      </li>
      <li v-else>
        <button type="button" :aria-label="$t('pagination__next')" @click="handleClick(page + 1)">
          <svg version="1.1" xmlns="http://www.w3.org/2000/svg" xlink="http://www.w3.org/1999/xlink" height="100%" viewBox="0 0 451.846 451.847" space="preserve">
            <use xlink:href="#icon-right" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<script>
import { computed } from '@common/utils/vueTools'

export default {
  props: {
    count: {
      type: Number,
      default: 0,
    },
    limit: {
      type: Number,
      default: 10,
    },
    page: {
      type: Number,
      default: 1,
    },
    btnLength: {
      type: Number,
      default: 7,
    },
  },
  emits: ['btn-click'],
  setup(props, { emit }) {
    const maxPage = computed(() => {
      return Math.ceil(props.count / props.limit) || 1
    })
    const pageEvg = computed(() => {
      return Math.floor(props.btnLength / 2)
    })
    const pages = computed(() => {
      if (maxPage.value <= props.btnLength) return Array.from({ length: maxPage.value }, (_, i) => i + 1)
      let start = props.page - pageEvg.value > 1
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        ? maxPage.value - props.page < pageEvg.value + 1
          ? maxPage.value - (props.btnLength - 1)
          : props.page - pageEvg.value
        : 1
      return Array.from({ length: props.btnLength }, (_, i) => start + i)
    })

    const handleClick = (page) => {
      emit('btn-click', page)
    }

    return {
      maxPage,
      pageEvg,
      pages,
      handleClick,
    }
  },
}
</script>


<style lang="less" module>
@import '@renderer/assets/styles/layout.less';

.pagination {
  display: inline-block;
  background:
    radial-gradient(120% 140% at 10% 0%, rgba(255, 255, 255, .12), rgba(255, 255, 255, 0) 58%),
    color-mix(in srgb, var(--shell-surface-strong, rgba(42, 48, 60, .86)) 82%, rgba(255, 255, 255, .08));
  border: 1px solid color-mix(in srgb, var(--shell-control-border, rgba(255, 255, 255, .16)) 86%, rgba(255, 255, 255, .12));
  // border-top-left-radius: 8px;
  border-radius: @radius-border;
  box-shadow:
    0 12px 28px rgba(13, 20, 32, .16),
    inset 0 1px 0 rgba(255, 255, 255, .16);
  overflow: hidden;
  ul {
    display: flex;
    flex-flow: row nowrap;
    // border: .0625rem solid @theme_color2;
    // border-radius: .3125rem;
    li {
      // margin-right: @padding;
      // color: var(--color-button-font);
      // border: .0625rem solid @theme_line;
      // border-radius: .3125rem;
      transition: 0.4s ease;
      transition-property: all;
      line-height: 1.2;
      display: flex;
      // border-right: none;
      svg {
        height: 1em;
      }
      span,
      button {
        display: block;
        padding: 7px 12px;
        line-height: 1.2;
        color: color-mix(in srgb, var(--shell-text, var(--color-font)) 82%, var(--color-primary) 18%);
        font-size: 13px;
        font-weight: 600;
      }
      &.active {
        span {
          color: #fff;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 84%, #fff 16%), color-mix(in srgb, var(--color-primary) 68%, #2c5fc7 32%));
          text-shadow: 0 1px 1px rgba(0, 0, 0, .28);
          box-shadow:
            0 10px 22px color-mix(in srgb, var(--color-primary) 24%, transparent),
            inset 0 1px 0 rgba(255, 255, 255, .32),
            inset 0 -1px 0 rgba(0, 0, 0, .14);
        }
      }
      button {
        background-color: transparent;
        border: none;
        cursor: pointer;
        outline: none;
        transition: background-color .3s ease;
        &:hover {
          color: #fff;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 76%, #fff 24%), color-mix(in srgb, var(--color-primary) 58%, #2c5fc7 42%));
        }
        &:active {
          color: #fff;
          background:
            linear-gradient(135deg, color-mix(in srgb, var(--color-primary) 82%, #1b2b4a 18%), color-mix(in srgb, var(--color-primary) 64%, #1f3f88 36%));
        }
      }
      &.disabled {
        span {
          color: color-mix(in srgb, var(--shell-muted, var(--color-font-label)) 78%, transparent);
          opacity: .62;
        }
      }
      &:first-child {
        span, button {
          border-top-left-radius: @radius-border;
          border-bottom-left-radius: @radius-border;
        }
        // border-right: .0625rem solid @theme_line;
      }
      &:last-child {
        span, button {
          border-top-right-radius: @radius-border;
          border-bottom-right-radius: @radius-border;
        }
        // border-right: .0625rem solid @theme_line;
      }
      &:first-child, &:last-child, &.first, &.last {
        span,
        button {
          line-height: 0;
        }
      }
    }
  }
}


</style>
