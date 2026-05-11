import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { db } from './db'

const app = new Hono()

app.use('/api/*', cors())

app.get('/api/event', (c) => {
  const event = db.query('SELECT * FROM events ORDER BY id DESC LIMIT 1').get()
  return c.json(event ?? null)
})

app.post('/api/event', async (c) => {
  const { password, name, destination, departure_date, booking_date } = await c.req.json()

  const setting = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string }
  if (password !== setting.value) {
    return c.json({ error: 'Invalid password' }, 401)
  }

  db.run('DELETE FROM events')
  db.run(
    'INSERT INTO events (name, destination, departure_date, booking_date) VALUES (?, ?, ?, ?)',
    [name, destination, departure_date, booking_date]
  )

  return c.json({ success: true })
})

app.post('/api/auth', async (c) => {
  const { password } = await c.req.json()
  const setting = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string }
  return c.json({ valid: password === setting.value })
})

// Serve built frontend static files
app.use('/*', serveStatic({ root: '../frontend/dist' }))

// SPA fallback for client-side routing
app.notFound(async (c) => {
  const html = await Bun.file('../frontend/dist/index.html').text()
  return c.html(html)
})

export default {
  port: 3001,
  fetch: app.fetch,
}
