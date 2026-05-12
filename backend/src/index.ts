import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { db } from './db'

const app = new Hono<{ Variables: { userId: number } }>()
app.use('/api/*', cors())

// ── Auth middleware ────────────────────────────────────────────────────────────
async function requireAuth(c: any, next: any) {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  const session = db.query('SELECT user_id FROM sessions WHERE token = ?').get(token) as { user_id: number } | null
  if (!session) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', session.user_id)
  return next()
}

// ── Auth endpoints ─────────────────────────────────────────────────────────────
app.post('/api/auth/register', async (c) => {
  const { email, password, name } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const existing = db.query('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) return c.json({ error: 'Email already registered' }, 409)

  const hash = await Bun.password.hash(password)
  const result = db.run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [email.toLowerCase(), hash, name || email.split('@')[0]]
  ) as { lastInsertRowid: number }

  const token = crypto.randomUUID()
  db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, result.lastInsertRowid])

  const user = db.query('SELECT id, email, name FROM users WHERE id = ?').get(result.lastInsertRowid)
  return c.json({ token, user })
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'Email and password required' }, 400)

  const user = db.query('SELECT id, email, name, password_hash FROM users WHERE email = ?')
    .get(email.toLowerCase()) as { id: number; email: string; name: string; password_hash: string } | null

  if (!user || !await Bun.password.verify(password, user.password_hash)) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  const token = crypto.randomUUID()
  db.run('INSERT INTO sessions (token, user_id) VALUES (?, ?)', [token, user.id])

  const { password_hash: _, ...safeUser } = user
  return c.json({ token, user: safeUser })
})

app.post('/api/auth/logout', requireAuth, (c) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  db.run('DELETE FROM sessions WHERE token = ?', [token])
  return c.json({ success: true })
})

app.get('/api/auth/me', requireAuth, (c) => {
  const user = db.query('SELECT id, email, name FROM users WHERE id = ?').get(c.get('userId'))
  return c.json(user)
})

// ── Events ─────────────────────────────────────────────────────────────────────
app.get('/api/events', requireAuth, (c) => {
  const events = db.query('SELECT * FROM events WHERE user_id = ? ORDER BY departure_date ASC').all(c.get('userId'))
  return c.json(events)
})

app.post('/api/events', requireAuth, async (c) => {
  const { name, destination, location, scene_type, travel_mode, departure_date, booking_date } = await c.req.json()
  const result = db.run(
    'INSERT INTO events (user_id, name, destination, location, scene_type, travel_mode, departure_date, booking_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [c.get('userId'), name, destination, location || destination, scene_type || 'beach', travel_mode || 'plane', departure_date, booking_date]
  ) as { lastInsertRowid: number }
  return c.json({ success: true, id: result.lastInsertRowid })
})

app.put('/api/events/:id', requireAuth, async (c) => {
  const { name, destination, location, scene_type, travel_mode, departure_date, booking_date } = await c.req.json()
  db.run(
    'UPDATE events SET name=?, destination=?, location=?, scene_type=?, travel_mode=?, departure_date=?, booking_date=? WHERE id=? AND user_id=?',
    [name, destination, location || destination, scene_type || 'beach', travel_mode || 'plane', departure_date, booking_date, c.req.param('id'), c.get('userId')]
  )
  return c.json({ success: true })
})

app.delete('/api/events/:id', requireAuth, async (c) => {
  db.run('DELETE FROM events WHERE id = ? AND user_id = ?', [c.req.param('id'), c.get('userId')])
  return c.json({ success: true })
})

// ── Share / Join ───────────────────────────────────────────────────────────────
app.post('/api/share', requireAuth, async (c) => {
  const { event_ids } = await c.req.json()
  if (!Array.isArray(event_ids) || event_ids.length === 0)
    return c.json({ error: 'No events specified' }, 400)

  // Verify all events belong to this user
  for (const id of event_ids) {
    const ev = db.query('SELECT id FROM events WHERE id = ? AND user_id = ?').get(id, c.get('userId'))
    if (!ev) return c.json({ error: 'Event not found' }, 404)
  }

  const token = crypto.randomUUID()
  db.run('INSERT INTO share_links (token, event_ids, created_by) VALUES (?, ?, ?)',
    [token, JSON.stringify(event_ids), c.get('userId')])
  return c.json({ token })
})

app.get('/api/join/:token', async (c) => {
  const link = db.query('SELECT event_ids FROM share_links WHERE token = ?')
    .get(c.req.param('token')) as { event_ids: string } | null
  if (!link) return c.json({ error: 'Not found' }, 404)

  const ids = JSON.parse(link.event_ids) as number[]
  const events = ids
    .map(id => db.query(
      'SELECT name, destination, location, scene_type, travel_mode, departure_date, booking_date FROM events WHERE id = ?'
    ).get(id))
    .filter(Boolean)
  return c.json(events)
})

app.post('/api/join/:token', requireAuth, async (c) => {
  const link = db.query('SELECT event_ids FROM share_links WHERE token = ?')
    .get(c.req.param('token')) as { event_ids: string } | null
  if (!link) return c.json({ error: 'Not found' }, 404)

  const ids = JSON.parse(link.event_ids) as number[]
  const userId = c.get('userId')
  let count = 0
  for (const id of ids) {
    const ev = db.query('SELECT * FROM events WHERE id = ?').get(id) as any
    if (!ev) continue
    db.run(
      'INSERT INTO events (user_id, name, destination, location, scene_type, travel_mode, departure_date, booking_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, ev.name, ev.destination, ev.location, ev.scene_type, ev.travel_mode, ev.departure_date, ev.booking_date]
    )
    count++
  }
  return c.json({ success: true, count })
})

// ── Weather ────────────────────────────────────────────────────────────────────
interface WeatherCache { data: object; timestamp: number }
const weatherCache = new Map<string, WeatherCache>()

app.get('/api/weather', requireAuth, async (c) => {
  const location = c.req.query('location')
  if (!location) return c.json(null)

  const cached = weatherCache.get(location)
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) return c.json(cached.data)

  try {
    const isPostcode = (s: string) => /^[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}$/i.test(s.trim())
    const parts = location.split(',').map(s => s.trim()).filter(s => s.length > 2 && !isPostcode(s))
    const queries = [location, ...parts].filter((v, i, a) => a.indexOf(v) === i)

    type GeoResult = { latitude: number; longitude: number; timezone: string; name: string; country: string }
    let geo: GeoResult | null = null
    for (const q of queries) {
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`)
      const d = await r.json() as { results?: GeoResult[] }
      if (d.results?.length) { geo = d.results[0]; break }
    }
    if (!geo) return c.json(null)

    const { latitude, longitude, timezone, name, country } = geo
    const wr = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=${encodeURIComponent(timezone)}&wind_speed_unit=mph&forecast_days=7`
    )
    const wd = await wr.json() as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number }
      daily: { sunrise: string[]; sunset: string[]; time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
    }

    const result = {
      temperature: Math.round(wd.current.temperature_2m),
      feels_like:  Math.round(wd.current.apparent_temperature),
      weather_code: wd.current.weather_code,
      wind_speed:  Math.round(wd.current.wind_speed_10m),
      humidity:    wd.current.relative_humidity_2m,
      timezone, location_name: name, country,
      sunrise: wd.daily.sunrise[0], sunset: wd.daily.sunset[0],
      forecast: wd.daily.time.slice(0, 7).map((date, i) => ({
        date, weather_code: wd.daily.weather_code[i],
        temp_max: Math.round(wd.daily.temperature_2m_max[i]),
        temp_min: Math.round(wd.daily.temperature_2m_min[i]),
      })),
    }

    weatherCache.set(location, { data: result, timestamp: Date.now() })
    return c.json(result)
  } catch { return c.json(null) }
})

// ── Static frontend ────────────────────────────────────────────────────────────
app.use('/*', serveStatic({ root: '../frontend/dist' }))
app.notFound(async (c) => {
  const html = await Bun.file('../frontend/dist/index.html').text()
  return c.html(html)
})

export default { port: 3001, fetch: app.fetch }
