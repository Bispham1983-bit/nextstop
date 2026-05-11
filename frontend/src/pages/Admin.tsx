import { useState } from 'react'

interface EventForm {
  name: string
  destination: string
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

      // Pre-fill form with existing event if one exists
      const eventRes = await fetch('/api/event')
      const existing = await eventRes.json()
      if (existing) {
        setForm({
          name: existing.name,
          destination: existing.destination,
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
              <label className={labelClass}>Event Name</label>
              <input
                type="text"
                value={form.name}
                onChange={set('name')}
                className={inputClass}
                placeholder="Mexico Summer 2026"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Destination</label>
              <input
                type="text"
                value={form.destination}
                onChange={set('destination')}
                className={inputClass}
                placeholder="Mexico"
                required
              />
            </div>

            <div>
              <label className={labelClass}>Booking Date</label>
              <input
                type="date"
                value={form.booking_date}
                onChange={set('booking_date')}
                className={inputClass}
                required
              />
            </div>

            <div>
              <label className={labelClass}>Departure Date</label>
              <input
                type="date"
                value={form.departure_date}
                onChange={set('departure_date')}
                className={inputClass}
                required
              />
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            {saved && (
              <p className="text-emerald-400 text-sm font-medium flex items-center gap-1.5">
                <span>✓</span> Saved successfully!
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <a
                href="/"
                className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
              >
                ← View
              </a>
              <button
                type="submit"
                disabled={saving}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
              >
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
