import { Database } from 'bun:sqlite'

export const db = new Database('./nextstop.db', { create: true })

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    destination TEXT NOT NULL,
    departure_date TEXT NOT NULL,
    booking_date TEXT NOT NULL
  )
`)

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
