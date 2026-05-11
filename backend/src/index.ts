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
  const { password, name, destination, location, scene_type, travel_mode, departure_date, booking_date } = await c.req.json()

  const setting = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string }
  if (password !== setting.value) {
    return c.json({ error: 'Invalid password' }, 401)
  }

  db.run('DELETE FROM events')
  db.run(
    'INSERT INTO events (name, destination, location, scene_type, travel_mode, departure_date, booking_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [name, destination, location || destination, scene_type || 'beach', travel_mode || 'plane', departure_date, booking_date]
  )

  return c.json({ success: true })
})

app.post('/api/auth', async (c) => {
  const { password } = await c.req.json()
  const setting = db.query("SELECT value FROM settings WHERE key = 'admin_password'").get() as { value: string }
  return c.json({ valid: password === setting.value })
})

// Weather — in-memory cache, refreshes every 30 minutes
interface WeatherCache { data: object; timestamp: number; location: string }
let weatherCache: WeatherCache | null = null

app.get('/api/weather', async (c) => {
  const event = db.query('SELECT * FROM events ORDER BY id DESC LIMIT 1').get() as Record<string, string> | null
  if (!event) return c.json(null)

  const location = event.location || event.destination

  if (weatherCache && weatherCache.location === location && Date.now() - weatherCache.timestamp < 30 * 60 * 1000) {
    return c.json(weatherCache.data)
  }

  try {
    // Build a list of progressively simpler queries to handle full addresses
    const isPostcode = (s: string) => /^[A-Z]{1,2}\d[\dA-Z]?\s*\d[A-Z]{2}$/i.test(s.trim())
    const parts = location.split(',').map(s => s.trim()).filter(s => s.length > 2 && !isPostcode(s))
    const queries = [location, ...parts].filter((v, i, a) => a.indexOf(v) === i)

    type GeoResult = { latitude: number; longitude: number; timezone: string; name: string; country: string }
    let geoResult: GeoResult | null = null
    for (const query of queries) {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`
      )
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
    const weatherData = await weatherRes.json() as {
      current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; relative_humidity_2m: number; time: string }
      daily: { sunrise: string[]; sunset: string[]; time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
    }

    const sunrise = weatherData.daily.sunrise[0]
    const sunset  = weatherData.daily.sunset[0]

    const result = {
      temperature:  Math.round(weatherData.current.temperature_2m),
      feels_like:   Math.round(weatherData.current.apparent_temperature),
      weather_code: weatherData.current.weather_code,
      wind_speed:   Math.round(weatherData.current.wind_speed_10m),
      humidity:     weatherData.current.relative_humidity_2m,
      timezone,
      location_name: name,
      country,
      sunrise,
      sunset,
      forecast: weatherData.daily.time.slice(0, 7).map((date, i) => ({
        date,
        weather_code: weatherData.daily.weather_code[i],
        temp_max: Math.round(weatherData.daily.temperature_2m_max[i]),
        temp_min: Math.round(weatherData.daily.temperature_2m_min[i]),
      })),
    }

    weatherCache = { data: result, timestamp: Date.now(), location }
    return c.json(result)
  } catch {
    return c.json(null)
  }
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
