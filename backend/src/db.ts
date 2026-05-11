import { Database } from 'bun:sqlite'

export const db = new Database(process.env.DB_PATH ?? './nextstop.db', { create: true })

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    departure_date TEXT NOT NULL,
    booking_date TEXT NOT NULL
  )
`)

// Migrations
try { db.run('ALTER TABLE events ADD COLUMN location TEXT NOT NULL DEFAULT ""') } catch { /* already exists */ }
try { db.run("ALTER TABLE events ADD COLUMN scene_type TEXT NOT NULL DEFAULT 'beach'") } catch { /* already exists */ }
try { db.run("ALTER TABLE events ADD COLUMN travel_mode TEXT NOT NULL DEFAULT 'plane'") } catch { /* already exists */ }

db.run(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

const existing = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get()
if (!existing) {
  db.run("INSERT INTO settings (key, value) VALUES ('admin_password', 'nextstop123')")
}
