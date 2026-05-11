import { useState } from 'react'

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city'
type TravelMode = 'plane' | 'car' | 'boat'

interface EventForm {
  name: string
  destination: string
  location: string
  scene_type: SceneType
  travel_mode: TravelMode
  departure_date: string
  booking_date: string
}

export function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [form, setForm] = useState<EventForm>({
    name: '',
    destination: '',
    location: '',
    scene_type: 'beach',
    travel_mode: 'plane',
    departure_date: '',
    booking_date: new Date().toISOString().split('T')[0],
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const { valid } = await res.json()
      if (!valid) { setAuthError('Wrong password'); return }

      setAuthenticated(true)

      const eventRes = await fetch('/api/event')
      const existing = await eventRes.json()
      if (existing) {
        setForm({
          name: existing.name,
          destination: existing.destination,
          location: existing.location || '',
          scene_type: (existing.scene_type as SceneType) || 'beach',
          travel_mode: (existing.travel_mode as TravelMode) || 'plane',
          departure_date: existing.departure_date,
          booking_date: existing.booking_date,
        })
      }
    } catch {
      setAuthError('Connection error')
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, password }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 4000)
      } else {
        setError('Failed to save. Check your connection.')
      }
    } catch {
      setError('Connection error')
    }
    setSaving(false)
  }

  const set = (key: keyof EventForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const inputClass = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors"
  const labelClass = "block text-blue-300/80 text-xs font-semibold tracking-wider uppercase mb-2"
  const toggleBtn = (active: boolean) =>
    `py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
      active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
    }`

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f2e] via-[#0d2a5e] to-[#1a5276] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <a href="/" className="text-blue-300/60 text-xs tracking-widest uppercase hover:text-blue-300 transition-colors">
            ← Next Stop
          </a>
          <h1 className="text-white text-2xl font-bold mt-2">Admin</h1>
        </div>

        {!authenticated ? (
          <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-4">
            <div>
              <label className={labelClass}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className={inputClass}
                placeholder="Enter password"
                autoFocus
                autoComplete="current-password"
              />
            </div>
            {authError && <p className="text-red-400 text-sm">{authError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSave} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-5">

            <div>
              <label className={labelClass}>Title <span className="normal-case font-normal opacity-60">— big headline on screen</span></label>
              <input type="text" value={form.name} onChange={set('name')} className={inputClass}
                placeholder="e.g. Mexico, Camping, NYC" required />
            </div>

            <div>
              <label className={labelClass}>Destination <span className="normal-case font-normal opacity-60">— shown on the map pin</span></label>
              <input type="text" value={form.destination} onChange={set('destination')} className={inputClass}
                placeholder="e.g. Mexico, Wales" required />
            </div>

            <div>
              <label className={labelClass}>City / Resort <span className="normal-case font-normal opacity-60">— subtitle &amp; used for weather</span></label>
              <input type="text" value={form.location} onChange={set('location')} className={inputClass}
                placeholder="e.g. Playa del Carmen, Tenby" />
            </div>

            <div>
              <label className={labelClass}>Scene</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { value: 'beach',       label: '🏖️ Beach'       },
                  { value: 'countryside', label: '🌄 Countryside'  },
                  { value: 'mountains',   label: '🏔️ Mountains'   },
                  { value: 'city',        label: '🏙️ City'        },
                ] as { value: SceneType; label: string }[]).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, scene_type: opt.value }))}
                    className={toggleBtn(form.scene_type === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Travel Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { value: 'plane', label: '✈️ Plane' },
                  { value: 'car',   label: '🚗 Car'   },
                  { value: 'boat',  label: '⛵ Boat'  },
                ] as { value: TravelMode; label: string }[]).map(opt => (
                  <button key={opt.value} type="button"
                    onClick={() => setForm(f => ({ ...f, travel_mode: opt.value }))}
                    className={toggleBtn(form.travel_mode === opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Booking Date</label>
              <input type="date" value={form.booking_date} onChange={set('booking_date')} className={inputClass} required />
            </div>

            <div>
              <label className={labelClass}>Departure Date</label>
              <input type="date" value={form.departure_date} onChange={set('departure_date')} className={inputClass} required />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {saved && (
              <p className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
                <span>✓</span> Saved successfully!
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <a href="/" className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                ← View
              </a>
              <button type="submit" disabled={saving}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {saving ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </form>
        )}

        <p className="text-center text-white/20 text-xs mt-6">
          Default password: nextstop123
        </p>
      </div>
    </div>
  )
}
