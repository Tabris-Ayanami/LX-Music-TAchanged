import zh_cn from './zh-cn.json'
import zh_tw from './zh-tw.json'
import en_us from './en-us.json'
import ja_jp from './ja-jp.json'

type Message = Record<keyof typeof zh_cn, string>
| Record<keyof typeof zh_tw, string>
| Record<keyof typeof en_us, string>
| Record<keyof typeof ja_jp, string>

type Messages = Record<(typeof langs)[number]['locale'], Message>

const langs = [
  {
    name: '简体中文',
    locale: 'zh-cn',
    // alternate: 'zh-hans',
    country: 'cn',
    fallback: true,
    message: zh_cn,
  },
  {
    name: '繁體中文',
    locale: 'zh-tw',
    // alternate: 'zh-hk',
    country: 'cn',
    message: zh_tw,
  },
  {
    name: 'English',
    locale: 'en-us',
    country: 'us',
    message: en_us,
  },
  {
    name: '日本語',
    locale: 'ja-jp',
    country: 'jp',
    message: ja_jp,
  },
] as const

const langList: Array<{
  name: string
  locale: keyof Messages
  alternate?: string
}> = []
// @ts-expect-error
const messages: Messages = {}
langs.forEach(item => {
  langList.push({
    name: item.name,
    locale: item.locale,
    // alternate: item.alternate,
  })
  messages[item.locale] = item.message
})

export {
  langList,
  messages,
}

export type {
  Messages,
  Message,
}

export * from './i18n'
