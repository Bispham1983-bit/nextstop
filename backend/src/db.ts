import { Database } from 'bun:sqlite'

export const db = new Database(process.env.DB_PATH ?? './nextstop.db', { create: true })

// ── Core tables ────────────────────────────────────────────────────────────────
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    email        TEXT    UNIQUE NOT NULL,
    password_hash TEXT   NOT NULL,
    name         TEXT    NOT NULL DEFAULT '',
    created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    name           TEXT    NOT NULL,
    destination    TEXT    NOT NULL,
    location       TEXT    NOT NULL DEFAULT '',
    scene_type     TEXT    NOT NULL DEFAULT 'beach',
    travel_mode    TEXT    NOT NULL DEFAULT 'plane',
    departure_date TEXT    NOT NULL,
    booking_date   TEXT    NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`)

// ── Migrations (safe, idempotent) ──────────────────────────────────────────────
const cols = (db.query("PRAGMA table_info(events)").all() as { name: string }[]).map(r => r.name)
if (!cols.includes('user_id'))     try { db.run('ALTER TABLE events ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0') } catch {}
if (!cols.includes('scene_type'))  try { db.run("ALTER TABLE events ADD COLUMN scene_type TEXT NOT NULL DEFAULT 'beach'") } catch {}
if (!cols.includes('travel_mode')) try { db.run("ALTER TABLE events ADD COLUMN travel_mode TEXT NOT NULL DEFAULT 'plane'") } catch {}
if (!cols.includes('location'))    try { db.run("ALTER TABLE events ADD COLUMN location TEXT NOT NULL DEFAULT ''") } catch {}
