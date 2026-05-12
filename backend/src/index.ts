import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { db } from './db'
import webpush from 'web-push'

// ── VAPID setup (auto-generate keys on first run) ─────────────────────────────
type VapidRow = { public_key: string; private_key: string }
let vapidKeys = db.query('SELECT public_key, private_key FROM vapid_keys LIMIT 1').get() as VapidRow | null
if (!vapidKeys) {
  const keys = webpush.generateVAPIDKeys()
  db.run('INSERT INTO vapid_keys (public_key, private_key) VALUES (?, ?)', [keys.publicKey, keys.privateKey])
  vapidKeys = { public_key: keys.publicKey, private_key: keys.privateKey }
}
webpush.setVapidDetails('mailto:noreply@nextstop.app', vapidKeys.public_key, vapidKeys.private_key)

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

  const user = db.query('SELECT id, email, name FROM users WHERE id = ?').get(result.lastInsertRowid) as { id: number; email: string; name: string }

  // Notify Home Assistant
  const webhookUrl = process.env.HA_WEBHOOK_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: user.name, email: user.email }),
    }).catch(() => {})
  }

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
  const userId = c.get('userId')
  const events = db.query(`
    SELECT DISTINCT e.*,
      CASE WHEN e.user_id = ? THEN 1 ELSE 0 END as is_creator,
      uc.name as creator_name,
      COALESCE((
        SELECT GROUP_CONCAT(n, '|') FROM (
          SELECT u1.name as n FROM users u1 WHERE u1.id = e.user_id
          UNION
          SELECT u2.name as n FROM event_members em2
          JOIN users u2 ON u2.id = em2.user_id
          WHERE em2.event_id = e.id
        )
      ), '') as going
    FROM events e
    JOIN users uc ON uc.id = e.user_id
    WHERE e.user_id = ? OR e.id IN (SELECT event_id FROM event_members WHERE user_id = ?)
    ORDER BY e.departure_date ASC
  `).all(userId, userId, userId)
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

  // Verify user is creator or member of each event
  const userId = c.get('userId')
  for (const id of event_ids) {
    const creator = db.query('SELECT id FROM events WHERE id = ? AND user_id = ?').get(id, userId)
    const member  = db.query('SELECT 1 FROM event_members WHERE event_id = ? AND user_id = ?').get(id, userId)
    if (!creator && !member) return c.json({ error: 'Event not found' }, 404)
  }

  const token = crypto.randomUUID()
  db.run('INSERT INTO share_links (token, event_ids, created_by) VALUES (?, ?, ?)',
    [token, JSON.stringify(event_ids), c.get('userId')])
  return c.json({ token })
})

app.get('/api/join/:token', async (c) => {
  const link = db.query('SELECT event_ids, created_by FROM share_links WHERE token = ?')
    .get(c.req.param('token')) as { event_ids: string; created_by: number } | null
  if (!link) return c.json({ error: 'Not found' }, 404)

  const sharer = db.query('SELECT name FROM users WHERE id = ?').get(link.created_by) as { name: string } | null
  const ids = JSON.parse(link.event_ids) as number[]
  const events = ids
    .map(id => db.query(
      'SELECT name, destination, location, scene_type, travel_mode, departure_date, booking_date FROM events WHERE id = ?'
    ).get(id))
    .filter(Boolean)
  return c.json({ sharer: sharer?.name ?? 'Someone', events })
})

app.post('/api/join/:token', requireAuth, async (c) => {
  const link = db.query('SELECT event_ids FROM share_links WHERE token = ?')
    .get(c.req.param('token')) as { event_ids: string } | null
  if (!link) return c.json({ error: 'Not found' }, 404)

  const ids = JSON.parse(link.event_ids) as number[]
  const userId = c.get('userId')
  let count = 0
  for (const id of ids) {
    const ev = db.query('SELECT id, user_id FROM events WHERE id = ?').get(id) as { id: number; user_id: number } | null
    if (!ev) continue
    // Skip if user is already the creator
    if (ev.user_id === userId) continue
    // Add as member (ignore if already a member)
    db.run('INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?, ?)', [id, userId])
    count++
  }
  return c.json({ success: true, count })
})

// ── Push helper ───────────────────────────────────────────────────────────────
async function sendPushToUser(userId: number, payload: { title: string; body: string; tag?: string }) {
  const subs = db.query('SELECT endpoint, keys FROM push_subscriptions WHERE user_id = ?')
    .all(userId) as { endpoint: string; keys: string }[]
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: JSON.parse(sub.keys) }, JSON.stringify(payload))
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404)
        db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint])
    }
  }
}

// ── Friends ────────────────────────────────────────────────────────────────────
app.get('/api/users/search', requireAuth, (c) => {
  const q = (c.req.query('q') ?? '').trim()
  if (q.length < 2) return c.json([])
  const userId = c.get('userId')
  const users = db.query(`
    SELECT u.id, u.name, u.email,
      f.id as friendship_id,
      f.status as friendship_status,
      CASE WHEN f.addressee_id = ? THEN 1 ELSE 0 END as is_addressee
    FROM users u
    LEFT JOIN friendships f ON (f.requester_id = u.id AND f.addressee_id = ?)
                            OR (f.addressee_id = u.id AND f.requester_id = ?)
    WHERE (u.name LIKE ? OR u.email LIKE ?) AND u.id != ?
    LIMIT 10
  `).all(userId, userId, userId, `%${q}%`, `%${q}%`, userId)
  return c.json(users)
})

app.get('/api/friends', requireAuth, (c) => {
  const userId = c.get('userId')
  const friends = db.query(`
    SELECT u.id, u.name, u.email, f.id as friendship_id
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
  `).all(userId, userId, userId)
  const sent = db.query(`
    SELECT f.id, u.name, u.email FROM friendships f
    JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
  `).all(userId)
  const received = db.query(`
    SELECT f.id, u.id as requester_id, u.name as requester_name, u.email as requester_email FROM friendships f
    JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
  `).all(userId)
  return c.json({ friends, sent, received })
})

app.post('/api/friends/request', requireAuth, async (c) => {
  const { addressee_id } = await c.req.json()
  const userId = c.get('userId')
  const existing = db.query(
    'SELECT id FROM friendships WHERE (requester_id=? AND addressee_id=?) OR (requester_id=? AND addressee_id=?)'
  ).get(userId, addressee_id, addressee_id, userId)
  if (existing) return c.json({ error: 'Already connected' }, 409)
  const result = db.run('INSERT INTO friendships (requester_id, addressee_id) VALUES (?, ?)', [userId, addressee_id]) as { lastInsertRowid: number }
  const sender = db.query('SELECT name FROM users WHERE id = ?').get(userId) as { name: string }
  sendPushToUser(addressee_id, { title: '👋 Friend request', body: `${sender.name} wants to be friends on Next Stop`, tag: `fr-${result.lastInsertRowid}` })
  return c.json({ success: true, id: result.lastInsertRowid })
})

app.put('/api/friends/:id/accept', requireAuth, (c) => {
  db.run("UPDATE friendships SET status='accepted' WHERE id=? AND addressee_id=?", [c.req.param('id'), c.get('userId')])
  return c.json({ success: true })
})

app.put('/api/friends/:id/decline', requireAuth, (c) => {
  db.run("UPDATE friendships SET status='declined' WHERE id=? AND addressee_id=?", [c.req.param('id'), c.get('userId')])
  return c.json({ success: true })
})

// ── Notifications ──────────────────────────────────────────────────────────────
app.get('/api/notifications', requireAuth, (c) => {
  const userId = c.get('userId')
  const friendRequests = db.query(`
    SELECT f.id, u.id as requester_id, u.name as requester_name, u.email as requester_email, 'friend_request' as type
    FROM friendships f JOIN users u ON u.id = f.requester_id
    WHERE f.addressee_id = ? AND f.status = 'pending'
  `).all(userId)
  const tripInvites = db.query(`
    SELECT ti.id, ti.event_id, e.name as event_name, ti.from_user_id, u.name as from_user_name, 'trip_invite' as type
    FROM trip_invites ti
    JOIN events e ON e.id = ti.event_id
    JOIN users u ON u.id = ti.from_user_id
    WHERE ti.to_user_id = ? AND ti.status = 'pending'
  `).all(userId)
  const sentFriendRequests = db.query(`
    SELECT f.id, u.id as addressee_id, u.name as addressee_name, 'sent_friend_request' as type
    FROM friendships f JOIN users u ON u.id = f.addressee_id
    WHERE f.requester_id = ? AND f.status = 'pending'
  `).all(userId)
  const sentTripInvites = db.query(`
    SELECT ti.id, ti.event_id, e.name as event_name, ti.to_user_id, u.name as to_user_name, 'sent_trip_invite' as type
    FROM trip_invites ti
    JOIN events e ON e.id = ti.event_id
    JOIN users u ON u.id = ti.to_user_id
    WHERE ti.from_user_id = ? AND ti.status = 'pending'
  `).all(userId)

  const items = [...friendRequests, ...tripInvites]
  const outgoing = [...sentFriendRequests, ...sentTripInvites]
  return c.json({ items, outgoing, count: items.length })
})

// ── Trip invites ───────────────────────────────────────────────────────────────
app.get('/api/trips/:id/friends-status', requireAuth, (c) => {
  const userId = c.get('userId')
  const eventId = Number(c.req.param('id'))
  const friends = db.query(`
    SELECT u.id, u.name FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id=? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id=? OR f.addressee_id=?) AND f.status='accepted'
  `).all(userId, userId, userId) as { id: number; name: string }[]

  const memberIds = new Set([
    ...(db.query('SELECT user_id FROM event_members WHERE event_id=?').all(eventId) as { user_id: number }[]).map(r => r.user_id),
    (db.query('SELECT user_id FROM events WHERE id=?').get(eventId) as { user_id: number } | null)?.user_id,
  ].filter(Boolean) as number[])

  const invitedIds = new Set(
    (db.query("SELECT to_user_id FROM trip_invites WHERE event_id=? AND status='pending'").all(eventId) as { to_user_id: number }[])
      .map(r => r.to_user_id)
  )

  const friendsWithEmail = db.query(`
    SELECT u.id, u.name, u.email FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.requester_id=? THEN f.addressee_id ELSE f.requester_id END
    WHERE (f.requester_id=? OR f.addressee_id=?) AND f.status='accepted'
  `).all(userId, userId, userId) as { id: number; name: string; email: string }[]

  return c.json(friendsWithEmail.map(f => ({
    id: f.id, name: f.name, email: f.email,
    status: memberIds.has(f.id) ? 'member' : invitedIds.has(f.id) ? 'invited' : 'none',
  })))
})

app.post('/api/trips/:id/invite', requireAuth, async (c) => {
  const { user_id: to_user_id } = await c.req.json()
  const userId = c.get('userId')
  const eventId = Number(c.req.param('id'))
  const creator = db.query('SELECT id FROM events WHERE id=? AND user_id=?').get(eventId, userId)
  const member  = db.query('SELECT 1 FROM event_members WHERE event_id=? AND user_id=?').get(eventId, userId)
  if (!creator && !member) return c.json({ error: 'Not found' }, 404)
  db.run(`INSERT INTO trip_invites (event_id, from_user_id, to_user_id) VALUES (?,?,?)
    ON CONFLICT(event_id, to_user_id) DO UPDATE SET status='pending', from_user_id=excluded.from_user_id`,
    [eventId, userId, to_user_id])
  const sender = db.query('SELECT name FROM users WHERE id=?').get(userId) as { name: string }
  const event  = db.query('SELECT name FROM events WHERE id=?').get(eventId) as { name: string }
  sendPushToUser(to_user_id, { title: '✈️ Trip invite', body: `${sender.name} invited you to join ${event.name}!`, tag: `invite-${eventId}` })
  return c.json({ success: true })
})

app.put('/api/invites/:id/accept', requireAuth, async (c) => {
  const userId = c.get('userId')
  const invite = db.query("SELECT * FROM trip_invites WHERE id=? AND to_user_id=? AND status='pending'")
    .get(c.req.param('id'), userId) as { id: number; event_id: number } | null
  if (!invite) return c.json({ error: 'Not found' }, 404)
  db.run("UPDATE trip_invites SET status='accepted' WHERE id=?", [invite.id])
  db.run('INSERT OR IGNORE INTO event_members (event_id, user_id) VALUES (?,?)', [invite.event_id, userId])
  return c.json({ success: true })
})

app.put('/api/invites/:id/decline', requireAuth, (c) => {
  db.run("UPDATE trip_invites SET status='declined' WHERE id=? AND to_user_id=?", [c.req.param('id'), c.get('userId')])
  return c.json({ success: true })
})

// ── Push notifications ─────────────────────────────────────────────────────────
app.get('/api/push/key', requireAuth, (c) => {
  return c.json({ publicKey: vapidKeys!.public_key })
})

app.post('/api/push/subscribe', requireAuth, async (c) => {
  const { endpoint, keys } = await c.req.json()
  const userId = c.get('userId')
  db.run(
    'INSERT INTO push_subscriptions (user_id, endpoint, keys) VALUES (?, ?, ?) ON CONFLICT(user_id, endpoint) DO UPDATE SET keys=excluded.keys',
    [userId, endpoint, JSON.stringify(keys)]
  )
  return c.json({ success: true })
})

const MILESTONES: Record<number, { title: string; body: string }> = {
  30: { title: '✈️ {name}',  body: '30 days to go... the countdown is on!' },
  14: { title: '✈️ {name}',  body: '2 weeks to go! Time to start thinking about packing.' },
  7:  { title: '🎉 {name}',  body: 'This week! Only 7 days to go.' },
  1:  { title: '⏰ {name}',  body: "Tomorrow! You're nearly there." },
  0:  { title: '🌴 {name}',  body: "Today's the day! Have an amazing trip!" },
}

async function checkMilestones() {
  const today = new Date(); today.setHours(0, 0, 0, 0)

  type Row = { id: number; user_id: number; name: string; departure_date: string; endpoint: string; sub_keys: string }
  const rows = db.query(`
    SELECT e.id, e.user_id, e.name, e.departure_date, ps.endpoint, ps.keys AS sub_keys
    FROM events e
    JOIN push_subscriptions ps ON ps.user_id = e.user_id
    WHERE date(e.departure_date) >= date('now')
  `).all() as Row[]

  for (const row of rows) {
    const dep = new Date(row.departure_date); dep.setHours(0, 0, 0, 0)
    const daysLeft = Math.round((dep.getTime() - today.getTime()) / 86400000)
    const tpl = MILESTONES[daysLeft]
    if (!tpl) continue

    const already = db.query(
      'SELECT 1 FROM notifications_sent WHERE endpoint=? AND event_id=? AND milestone_days=?'
    ).get(row.endpoint, row.id, daysLeft)
    if (already) continue

    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: JSON.parse(row.sub_keys) },
        JSON.stringify({
          title: tpl.title.replace('{name}', row.name),
          body:  tpl.body,
          tag:   `${row.id}-${daysLeft}`,
        })
      )
      db.run('INSERT OR IGNORE INTO notifications_sent (endpoint, event_id, milestone_days) VALUES (?, ?, ?)',
        [row.endpoint, row.id, daysLeft])
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [row.endpoint])
      }
    }
  }
}

// Run on startup and every 6 hours
checkMilestones()
setInterval(checkMilestones, 6 * 60 * 60 * 1000)

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
