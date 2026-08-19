#!/usr/bin/env node
'use strict'

const fs = require('node:fs')

const Database = require('better-sqlite3')

const [requestPath, responsePath] = process.argv.slice(2)

const run = () => {
  if (!requestPath || !responsePath) throw new Error('SQLite worker requires request and response paths')
  const request = JSON.parse(fs.readFileSync(requestPath, 'utf8'))
  fs.rmSync(`${request.databasePath}-shm`, { force: true })
  const db = new Database(request.databasePath)
  try {
    if (request.operation === 'checkpoint-read-local') {
      db.pragma('wal_checkpoint(TRUNCATE)')
      return {
        rows: db.prepare("SELECT rowid AS workspaceRowId, meta FROM my_list_music_info WHERE source = 'local' ORDER BY rowid").all(),
      }
    }
    if (request.operation === 'rewrite-local') {
      const update = db.prepare('UPDATE my_list_music_info SET meta = ? WHERE rowid = ?')
      db.transaction(rows => {
        for (const row of rows) update.run(row.meta, row.workspaceRowId)
      })(request.rows)
      db.pragma('wal_checkpoint(TRUNCATE)')
      return { updatedRowCount: request.rows.length }
    }
    throw new Error(`unknown SQLite worker operation: ${request.operation}`)
  } finally {
    db.close()
  }
}

try {
  const result = run()
  fs.writeFileSync(responsePath, JSON.stringify(result), { encoding: 'utf8', flag: 'wx' })
} catch (error) {
  process.stderr.write(`${error.stack ?? error.message}\n`)
  process.exitCode = 1
}
