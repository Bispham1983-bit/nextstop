import { useState, useEffect } from 'react'
import { useAuth, useApiFetch } from '../context/AuthContext'

function ShareModal({ url, count, onClose }: { url: string; count: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 border border-white/20 space-y-4"
        style={{ background: 'linear-gradient(to bottom, #0d2a5e, #0a0f2e)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-white font-bold">Share Trip{count > 1 ? 's' : ''}</h3>
            {count > 1 && <p className="text-white/40 text-xs mt-0.5">{count} trips in this link</p>}
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white rounded-2xl p-3">
            <img src={qr} width={180} height={180} alt="QR Code" className="block" />
          </div>
        </div>

        {/* Copyable link */}
        <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 border border-white/20">
          <p className="text-white/60 text-xs flex-1 truncate">{url}</p>
          <button onClick={copy}
            className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex-shrink-0 transition-colors">
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>

        <p className="text-white/25 text-xs text-center">
          Anyone with this link can add {count > 1 ? 'these trips' : 'this trip'} to their account
        </p>
      </div>
    </div>
  )
}

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city'
type TravelMode = 'plane' | 'car' | 'boat'

interface Event {
  id: number
  name: string
  destination: string
  location: string
  scene_type: SceneType
  travel_mode: TravelMode
  departure_date: string
  booking_date: string
}

const EMPTY_FORM = {
  name: '', destination: '', location: '',
  scene_type: 'beach' as SceneType,
  travel_mode: 'plane' as TravelMode,
  departure_date: '',
  booking_date: new Date().toISOString().split('T')[0],
}

const SCENE_ICONS: Record<SceneType, string> = {
  beach: '🏖️', countryside: '🌄', mountains: '🏔️', city: '🏙️',
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  if (diff < 0) return 'departed'
  const days = Math.ceil(diff / 86400000)
  return `${days} day${days === 1 ? '' : 's'}`
}

export function Admin() {
  const { user, logout } = useAuth()
  const apiFetch = useApiFetch()

  const [events, setEvents] = useState<Event[]>([])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })

  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [error, setError] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [shareModal, setShareModal] = useState<{ url: string; count: number } | null>(null)
  const [sharing, setSharing] = useState(false)

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleShare = async (ids: number[]) => {
    setSharing(true)
    try {
      const res = await apiFetch('/api/share', { method: 'POST', body: JSON.stringify({ event_ids: ids }) })
      const { token } = await res.json()
      const url = `${window.location.origin}/join/${token}`
      setShareModal({ url, count: ids.length })
      setSelectMode(false)
      setSelectedIds(new Set())
    } catch {}
    setSharing(false)
  }

  const inputClass = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors"
  const labelClass = "block text-blue-300/80 text-xs font-semibold tracking-wider uppercase mb-2"
  const toggleBtn  = (active: boolean) =>
    `py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
      active ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/10 border-white/20 text-white/70 hover:bg-white/20'
    }`

  const loadEvents = async () => {
    const res = await apiFetch('/api/events')
    const data = await res.json()
    setEvents(Array.isArray(data) ? data : [])
  }

  useEffect(() => { loadEvents() }, [])

  const handleEdit = (event: Event) => {
    setEditingId(event.id)
    setForm({
      name: event.name, destination: event.destination, location: event.location,
      scene_type: event.scene_type, travel_mode: event.travel_mode,
      departure_date: event.departure_date, booking_date: event.booking_date,
    })
    setShowForm(true)
    setError('')
  }

  const handleNew = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
    setError('')
  }

  const handleCancel = () => { setShowForm(false); setError('') }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const url    = editingId ? `/api/events/${editingId}` : '/api/events'
      const method = editingId ? 'PUT' : 'POST'
      const res = await apiFetch(url, {
        method,
        body: JSON.stringify(form),
      })
      if (res.ok) {
        await loadEvents()
        setShowForm(false)
      } else {
        setError('Failed to save.')
      }
    } catch { setError('Connection error') }
    setSaving(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this trip?')) return
    setDeleting(id)
    try {
      await apiFetch(`/api/events/${id}`, { method: 'DELETE' })
      await loadEvents()
    } catch { /* ignore */ }
    setDeleting(null)
  }

  const set = (key: keyof typeof EMPTY_FORM) =>
    (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f2e] via-[#0d2a5e] to-[#1a5276] px-4 py-10">
      <div className="w-full max-w-sm mx-auto">

        <div className="text-center mb-8">
          <a href="/" className="text-blue-300/60 text-xs tracking-widest uppercase hover:text-blue-300 transition-colors">
            ← Next Stop
          </a>
          <h1 className="text-white text-2xl font-bold mt-2">My Trips</h1>
          {user && (
            <div className="flex items-center justify-center gap-3 mt-3">
              <p className="text-white/40 text-xs">{user.name}</p>
              <button onClick={logout}
                className="text-white/30 hover:text-white/60 text-xs transition-colors underline underline-offset-2">
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Trip list */}
        {!showForm && (
          <div className="space-y-3">
            {/* List header */}
            {events.length > 0 && (
              <div className="flex justify-between items-center px-1 mb-1">
                <span className="text-white/30 text-xs">{events.length} trip{events.length !== 1 ? 's' : ''}</span>
                {events.length > 1 && (
                  <button onClick={() => { setSelectMode(m => !m); setSelectedIds(new Set()) }}
                    className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors">
                    {selectMode ? 'Cancel' : 'Select'}
                  </button>
                )}
              </div>
            )}

            {events.length === 0 && (
              <p className="text-white/40 text-center py-8 text-sm">No trips yet — add one below!</p>
            )}

            {events.map(event => (
              <div key={event.id} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 flex items-center gap-3"
                style={selectMode && selectedIds.has(event.id) ? { borderColor: 'rgba(96,165,250,0.6)', background: 'rgba(96,165,250,0.12)' } : {}}>

                {/* Select checkbox */}
                {selectMode && (
                  <button onClick={() => toggleSelect(event.id)}
                    className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
                    style={{ borderColor: selectedIds.has(event.id) ? '#60a5fa' : 'rgba(255,255,255,0.3)',
                             background: selectedIds.has(event.id) ? '#3b82f6' : 'transparent' }}>
                    {selectedIds.has(event.id) && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="2,6 5,9 10,3"/>
                      </svg>
                    )}
                  </button>
                )}

                <span className="text-2xl">{SCENE_ICONS[event.scene_type] ?? '✈️'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold truncate">{event.name}</p>
                  <p className="text-white/50 text-xs truncate">{event.location || event.destination}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {formatDate(event.departure_date)} · {daysUntil(event.departure_date)}
                  </p>
                </div>

                {/* Action buttons — hidden in select mode */}
                {!selectMode && (
                  <div className="flex gap-2 flex-shrink-0">
                    {/* Share */}
                    <button onClick={() => handleShare([event.id])} disabled={sharing}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                    {/* Edit */}
                    <button onClick={() => handleEdit(event)}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    {/* Delete */}
                    <button onClick={() => handleDelete(event.id)} disabled={deleting === event.id}
                      className="p-2 rounded-lg bg-white/10 hover:bg-red-500/40 transition-colors disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                        <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Share selected */}
            {selectMode && selectedIds.size > 0 && (
              <button onClick={() => handleShare(Array.from(selectedIds))} disabled={sharing}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                {sharing ? 'Creating link...' : `Share ${selectedIds.size} trip${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            )}

            {!selectMode && (
              <button onClick={handleNew}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                <span className="text-lg leading-none">+</span> Add Trip
              </button>
            )}
          </div>
        )}

        {/* Share modal */}
        {shareModal && (
          <ShareModal url={shareModal.url} count={shareModal.count} onClose={() => setShareModal(null)} />
        )}

        {/* Add / Edit form */}
        {showForm && (
          <form onSubmit={handleSave} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-5">
            <h2 className="text-white font-bold text-lg">{editingId ? 'Edit Trip' : 'New Trip'}</h2>

            <div>
              <label className={labelClass}>Title <span className="normal-case font-normal opacity-60">— big headline</span></label>
              <input type="text" value={form.name} onChange={set('name')} className={inputClass}
                placeholder="e.g. Mexico, Camping, NYC" required />
            </div>

            <div>
              <label className={labelClass}>Destination <span className="normal-case font-normal opacity-60">— map pin</span></label>
              <input type="text" value={form.destination} onChange={set('destination')} className={inputClass}
                placeholder="e.g. Mexico, Wales" required />
            </div>

            <div>
              <label className={labelClass}>City / Resort <span className="normal-case font-normal opacity-60">— subtitle &amp; weather</span></label>
              <input type="text" value={form.location} onChange={set('location')} className={inputClass}
                placeholder="e.g. Playa del Carmen, Tenby" />
            </div>

            <div>
              <label className={labelClass}>Scene</label>
              <div className="grid grid-cols-2 gap-2">
                {(['beach','countryside','mountains','city'] as SceneType[]).map(v => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, scene_type: v }))}
                    className={toggleBtn(form.scene_type === v)}>
                    {SCENE_ICONS[v]} {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Travel Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {([['plane','✈️ Plane'],['car','🚗 Car'],['boat','⛵ Boat']] as [TravelMode,string][]).map(([v,l]) => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, travel_mode: v }))}
                    className={toggleBtn(form.travel_mode === v)}>{l}</button>
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

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={handleCancel}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" disabled={saving}
                className="flex-[2] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                {saving ? 'Saving...' : editingId ? 'Update Trip' : 'Add Trip'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
