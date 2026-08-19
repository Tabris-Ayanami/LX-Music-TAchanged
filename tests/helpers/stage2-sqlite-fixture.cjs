'use strict'

const fs = require('node:fs')

const Database = require('better-sqlite3')

const [operation, databasePath, configPath] = process.argv.slice(2)

const createSchema = db => {
  db.exec(`
    CREATE TABLE my_list_music_info (
      id TEXT NOT NULL,
      listId TEXT NOT NULL,
      name TEXT NOT NULL,
      singer TEXT NOT NULL,
      source TEXT NOT NULL,
      interval TEXT,
      meta TEXT NOT NULL,
      UNIQUE(id, listId)
    )
  `)
}

const insertRows = (db, rows) => {
  const insert = db.prepare(`
    INSERT INTO my_list_music_info (id, listId, name, singer, source, interval, meta)
    VALUES (@id, 'default', @name, 'fixture', @source, '1:00', @meta)
  `)
  for (const row of rows) insert.run(row)
}

const createDatabase = holdWalOpen => {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  const db = new Database(databasePath)
  if (holdWalOpen) {
    db.pragma('journal_mode = WAL')
    db.pragma('wal_autocheckpoint = 0')
  }
  createSchema(db)
  const checkpointIndex = config.rows.findIndex(row => row.id === config.walOnlyRowId)
  if (holdWalOpen && checkpointIndex >= 0) {
    insertRows(db, config.rows.slice(0, checkpointIndex))
    db.pragma('wal_checkpoint(TRUNCATE)')
    insertRows(db, config.rows.slice(checkpointIndex))
  } else {
    insertRows(db, config.rows)
  }
  if (!holdWalOpen) {
    db.close()
    return
  }

  process.stdout.write('READY\n')
  process.stdin.resume()
  process.stdin.once('end', () => {
    db.close()
  })
}

if (operation === 'create') {
  createDatabase(false)
} else if (operation === 'hold-wal') {
  createDatabase(true)
} else if (operation === 'read') {
  const db = new Database(databasePath, { readonly: true })
  try {
    process.stdout.write(JSON.stringify(db.prepare('SELECT id, source, meta FROM my_list_music_info ORDER BY id').all()))
  } finally {
    db.close()
  }
} else {
  throw new Error(`unknown fixture operation: ${operation}`)
}
