'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const path = require('node:path')

const {
  parseCookieToRecord,
  recordToCookieString,
  extractLoginCookie,
  COOKIE_ATTR_KEYS,
} = require(path.join(__dirname, '..', '..', 'src', 'common', 'wyAccountCookie.ts'))

test('RG-NCM-01: parseCookieToRecord keeps values containing "=" intact', () => {
  const record = parseCookieToRecord('MUSIC_U=eyJ0eXAiOiJKV1QifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw==; __csrf=abc')
  assert.deepEqual(record, {
    MUSIC_U: 'eyJ0eXAiOiJKV1QifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw==',
    __csrf: 'abc',
  })
})

test('RG-NCM-02: parseCookieToRecord keeps values containing spaces and Chinese', () => {
  const record = parseCookieToRecord('bn_a=value with spaces; nmc=中文值')
  assert.deepEqual(record, {
    bn_a: 'value with spaces',
    nmc: '中文值',
  })
})

test('RG-NCM-03: parseCookieToRecord tolerates newlines, empty items and leading/trailing whitespace', () => {
  const record = parseCookieToRecord('  a=1;  \nb=2;\n\n c = 3 ;\r\n')
  assert.deepEqual(record, { a: '1', b: '2', c: '3' })
})

test('RG-NCM-04: parseCookieToRecord skips malformed items without throwing', () => {
  const record = parseCookieToRecord('a=1; no-equals; =empty-key; b=2')
  assert.deepEqual(record, { a: '1', b: '2' })
})

test('RG-NCM-05: parseCookieToRecord returns empty record for empty or invalid input', () => {
  assert.deepEqual(parseCookieToRecord(''), {})
  assert.deepEqual(parseCookieToRecord('   '), {})
  assert.doesNotThrow(() => parseCookieToRecord(undefined))
})

test('RG-NCM-06: extractLoginCookie strips Set-Cookie attribute fields and keeps credentials', () => {
  const input = 'MUSIC_U=eyJ0eXAiOiJKV1QifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw==; NMTID=00OZLp2VVgq9QdwokUgq3XNfOddQyIAAAF_6i8eJg; Max-Age=315360000; Expires=Mon, 25 Aug 2036 14:44:08 GMT; Path=/; Domain=music.163.com; Secure; HttpOnly; SameSite=Lax'
  const output = extractLoginCookie(input)
  const entries = output.split('; ').map(item => item.split('=')[0])
  assert.deepEqual(entries, ['MUSIC_U', 'NMTID'])
  assert.match(output, /MUSIC_U=eyJ0eXAiOiJKV1QifQ\.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw==/)
  assert.match(output, /NMTID=00OZLp2VVgq9QdwokUgq3XNfOddQyIAAAF_6i8eJg/)
})

test('RG-NCM-07: extractLoginCookie returns empty string for empty input', () => {
  assert.equal(extractLoginCookie(''), '')
  assert.equal(extractLoginCookie('Max-Age=315360000; Path=/'), '')
})

test('RG-NCM-08: extractLoginCookie removes attribute keys case-insensitively', () => {
  const output = extractLoginCookie('MUSIC_U=abc; path=/; max-age=100; httponly')
  assert.equal(output, 'MUSIC_U=abc')
})

test('RG-NCM-09: extractLoginCookie keeps remaining valid entries when one item is malformed', () => {
  const output = extractLoginCookie('MUSIC_U=abc; broken; NMTID=def; handle=ok')
  assert.equal(output, 'MUSIC_U=abc; NMTID=def; handle=ok')
})

test('RG-NCM-10: recordToCookieString round-trips a record losslessly', () => {
  const record = {
    MUSIC_U: 'eyJhbGci==',
    nickname: '中文 value = ok',
    __csrf: 'x=1',
  }
  const text = recordToCookieString(record)
  assert.deepEqual(parseCookieToRecord(text), record)
})

test('RG-NCM-11: COOKIE_ATTR_KEYS covers standard Set-Cookie attribute names', () => {
  for (const key of ['Max-Age', 'Expires', 'Path', 'Domain', 'Secure', 'HttpOnly', 'SameSite']) {
    assert.equal(COOKIE_ATTR_KEYS.has(key), true, `missing attribute key: ${key}`)
  }
})