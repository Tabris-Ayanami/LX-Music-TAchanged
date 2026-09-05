/**
 * 网易云 Cookie 规范化工具（主进程与渲染进程共享）
 * 用于解决 api-enhanced 内 cookieToJson 对值含 '=' 条目整体丢失、以及
 * Set-Cookie 响应头携带 Max-Age/Expires/Path 等属性字段导致凭据被污染的问题。
 */

/**
 * 解析 Cookie 文本为键值对记录。
 * 规则：按 ';' 或换行拆分（容忍空条目与首尾空白）；
 * 按首个 '=' 切分键与值，键与值均 trim，值完整保留（可含 '='、空格、中文等）；
 * 无 '=' 或键为空的条目跳过，单条失败不影响其余条目，任何输入均不抛异常。
 */
export const parseCookieToRecord = (text: string): Record<string, string> => {
  const record: Record<string, string> = {}
  if (typeof text != 'string') return record
  const items = text.split(/[;\r\n]+/)
  for (const rawItem of items) {
    const item = rawItem.trim()
    if (!item) continue
    const eqIndex = item.indexOf('=')
    if (eqIndex < 0) continue
    const key = item.slice(0, eqIndex).trim()
    if (!key) continue
    record[key] = item.slice(eqIndex + 1).trim()
  }
  return record
}

/**
 * 将键值对记录序列化为规范 Cookie 文本（key=value; key2=value2）。
 * 仅序列化真实键值对，不含任何 Cookie 属性描述字段。
 */
export const recordToCookieString = (record: Record<string, string>): string => {
  const pairs: string[] = []
  for (const [key, value] of Object.entries(record)) pairs.push(`${key}=${value}`)
  return pairs.join('; ')
}

/**
 * Cookie 属性描述键集合（可出现在 Set-Cookie 响应头中，但不属于登录凭据）。
 */
export const COOKIE_ATTR_KEYS: ReadonlySet<string> = new Set([
  'Max-Age',
  'Expires',
  'Path',
  'Domain',
  'Secure',
  'HttpOnly',
  'SameSite',
])

const COOKIE_ATTR_KEYS_LOWER: ReadonlySet<string> = new Set(
  Array.from(COOKIE_ATTR_KEYS, key => key.toLowerCase()),
)

/**
 * 从 api-enhanced 返回的原始 Set-Cookie 文本中提取仅含登录凭据键值对的规范文本。
 * 空输入返回空串且不抛异常。
 */
export const extractLoginCookie = (setCookieText: string): string => {
  const record = parseCookieToRecord(setCookieText)
  const credentials = Object.fromEntries(Object.entries(record).filter(([key]) => !COOKIE_ATTR_KEYS_LOWER.has(key.toLowerCase())))
  return recordToCookieString(credentials)
}
