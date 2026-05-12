import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { db } from './db'

const app = new Hono()

app.use('/api/*', cors())

// ── Auth helper ────────────────────────────────────────────────────────────────
function checkPassword(password: string): boolean {
  const setting = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string }
  return password === setting.value
}

// ── Events ─────────────────────────────────────────────────────────────────────
app.get('/api/events', (c) => {
  const events = db.query('SELECT * FROM events ORDER BY departure_date ASC').all()
  return c.json(events)
})

app.post('/api/events', async (c) => {
  const { password, name, destination, location, scene_type, travel_mode, departure_date, booking_date } = await c.req.json()
  if (!checkPassword(password)) return c.json({ error: 'Invalid password' }, 401)
  const result = db.run(
    'INSERT INTO events (name, destination, location, scene_type, travel_mode, departure_date, booking_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, destination, location || destination, scene_type || 'beach', travel_mode || 'plane', departure_date, booking_date]
  ) as { lastInsertRowid: number }
  return c.json({ success: true, id: result.lastInsertRowid })
})

app.put('/api/events/:id', async (c) => {
  const { password, name, destination, location, scene_type, travel_mode, departure_date, booking_date } = await c.req.json()
  if (!checkPassword(password)) return c.json({ error: 'Invalid password' }, 401)
  db.run(
    'UPDATE events SET name=?, destination=?, location=?, scene_type=?, travel_mode=?, departure_date=?, booking_date=? WHERE id=?',
    [name, destination, location || destination, scene_type || 'beach', travel_mode || 'plane', departure_date, booking_date, c.req.param('id')]
  )
  return c.json({ success: true })
})

app.delete('/api/events/:id', async (c) => {
  const { password } = await c.req.json()
  if (!checkPassword(password)) return c.json({ error: 'Invalid password' }, 401)
  db.run('DELETE FROM events WHERE id=?', [c.req.param('id')])
  return c.json({ success: true })
})

// ── Auth ───────────────────────────────────────────────────────────────────────
app.post('/api/auth', async (c) => {
  const { password } = await c.req.json()
  return c.json({ valid: checkPassword(password) })
})

// ── Weather — cached per location ─────────────────────────────────────────────
interface WeatherCache { data: object; timestamp: number }
const weatherCache = new Map<string, WeatherCache>()

app.get('/api/weather', async (c) => {
  const location = c.req.query('location')
  if (!location) return c.json(null)

  const cached = weatherCache.get(location)
  if (cached && Date.now() - cached.timestamp < 30 * 60 * 1000) {
    return c.json(cached.data)
  }

  try {
    const isPostcode = (s: string) => /^[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}$/i.test(s.trim())
    const parts = location.split(',').map(s => s.trim()).filter(s => s.length > 2 && !isPostcode(s))
    const queries = [location, ...parts].filter((v, i, a) => a.indexOf(v) === i)

    type GeoResult = { latitude: number; longitude: number; timezone: string; name: string; country: string }
    let geoResult: GeoResult | null = null
    for (const query of queries) {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`)
      const data = await res.json() as { results?: GeoResult[] }
      if (data.results?.length) { geoResult = data.results[0]; break }
    }
    if (!geoResult) return c.json(null)

    const { latitude, longitude, timezone, name, country } = geoResult
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=sunrise,sunset,weather_code,temperature_2m_max,temperature_2m_min` +
      `&timezone=${encodeURIComponent(timezone)}&wind_speed_unit=mph&forecast_days=7`
    )
    const wd = await weatherRes.json() as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number }
      daily: { sunrise: string[]; sunset: string[]; time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
    }

    const result = {
      temperature:   Math.round(wd.current.temperature_2m),
      feels_like:    Math.round(wd.current.apparent_temperature),
      weather_code:  wd.current.weather_code,
      wind_speed:    Math.round(wd.current.wind_speed_10m),
      humidity:      wd.current.relative_humidity_2m,
      timezone, location_name: name, country,
      sunrise: wd.daily.sunrise[0],
      sunset:  wd.daily.sunset[0],
      forecast: wd.daily.time.slice(0, 7).map((date, i) => ({
        date,
        weather_code: wd.daily.weather_code[i],
        temp_max: Math.round(wd.daily.temperature_2m_max[i]),
        temp_min: Math.round(wd.daily.temperature_2m_min[i]),
      })),
    }

    weatherCache.set(location, { data: result, timestamp: Date.now() })
    return c.json(result)
  } catch {
    return c.json(null)
  }
})

// ── Static frontend ────────────────────────────────────────────────────────────
app.use('/*', serveStatic({ root: '../frontend/dist' }))
app.notFound(async (c) => {
  const html = await Bun.file('../frontend/dist/index.html').text()
  return c.html(html)
})

export default { port: 3001, fetch: app.fetch }
