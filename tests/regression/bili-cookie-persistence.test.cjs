const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const assert = require('node:assert/strict')

const rootDir = path.resolve(__dirname, '..', '..')
const requestSource = fs.readFileSync(path.join(rootDir, 'src', 'main', 'modules', 'bili', 'request.ts'), 'utf8')
const cookieSource = fs.readFileSync(path.join(rootDir, 'src', 'main', 'modules', 'bili', 'cookie.ts'), 'utf8')
const indexSource = fs.readFileSync(path.join(rootDir, 'src', 'main', 'modules', 'bili', 'index.ts'), 'utf8')

test('RG-061: Bilibili login cookies persist without rotating the saved device identity', () => {
  assert.match(
    requestSource,
    /const BILI_COOKIE_PERSIST_SECONDS = 30 \* 24 \* 60 \* 60[\s\S]*expirationDate: Math\.floor\(Date\.now\(\) \/ 1000\) \+ BILI_COOKIE_PERSIST_SECONDS/,
    'Imported Bilibili cookies should be persisted in the Electron cookie store for 30 days',
  )
  assert.match(
    requestSource,
    /export const restoreStoredBiliCookie = async\(\)[\s\S]*setPersistentSessionCookie\(name, value\)/,
    'Saved Bilibili cookies should be restored to the Electron session at startup',
  )
  assert.match(
    indexSource,
    /restoreStoredBiliCookie\(\)\.then\(injectAuthCookie\)/,
    'Saved account and device cookies should be restored before auxiliary cookies are generated',
  )
  assert.match(
    cookieSource,
    /const hasBuvidPair = cookieMap\.has\('buvid3'\) && cookieMap\.has\('buvid4'\)[\s\S]*if \(!hasBuvidPair\) tasks\.push\(refreshBuvidCookie\(\)\)/,
    'A complete saved Bilibili device identity should not be replaced on every launch',
  )
  assert.match(
    requestSource,
    /const cookies = parseCookieString\(getStoredCookie\(\)\)[\s\S]*if \(!cookies\.has\(cookie\.name\) \|\| SESSION_COOKIE_OVERRIDES\.has\(cookie\.name\)\) cookies\.set/,
    'The outgoing Cookie header should de-duplicate stored and session cookie names',
  )
})
