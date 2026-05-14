import { useState, useEffect, useCallback } from 'react'
import { useAuth, useApiFetch } from '../context/AuthContext'

function ShareModal({ url, names, onClose }: { url: string; names: string[]; onClose: () => void }) {
  const [copiedLink, setCopiedLink] = useState(false)
  const [copiedMsg, setCopiedMsg] = useState(false)

  const tripLabel = names.length === 1 ? names[0] : `${names.length} trips`
  const message = names.length === 1
    ? `You've been invited to join my trip to ${names[0]} on Next Stop ✈️\n${url}`
    : `You've been invited to join ${names.length} trips on Next Stop ✈️\n${url}`

  const copyLink = () => {
    navigator.clipboard.writeText(url)
    setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000)
  }
  const copyMsg = () => {
    navigator.clipboard.writeText(message)
    setCopiedMsg(true); setTimeout(() => setCopiedMsg(false), 2000)
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
            <h3 className="text-white font-bold">Share {tripLabel}</h3>
            <p className="text-white/40 text-xs mt-0.5">Scan or send the link below</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center">
          <div className="bg-white rounded-2xl p-3">
            <img src={qr} width={180} height={180} alt="QR Code" className="block" />
          </div>
        </div>

        {/* Copyable message */}
        <div className="bg-white/10 rounded-xl px-4 py-3 border border-white/20 space-y-2">
          <p className="text-white/50 text-xs whitespace-pre-line leading-relaxed">{message}</p>
          <button onClick={copyMsg}
            className="text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors">
            {copiedMsg ? '✓ Copied!' : 'Copy message'}
          </button>
        </div>

        {/* Link only */}
        <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/10">
          <p className="text-white/40 text-xs flex-1 truncate">{url}</p>
          <button onClick={copyLink}
            className="text-white/50 hover:text-blue-400 text-xs font-semibold flex-shrink-0 transition-colors">
            {copiedLink ? '✓' : 'Link only'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface FriendStatus {
  id: number
  name: string
  email: string
  status: 'member' | 'invited' | 'none'
  invite_id?: number
}

function InviteModal({ eventId, eventName, onClose }: {
  eventId: number
  eventName: string
  onClose: () => void
}) {
  const apiFetch = useApiFetch()
  const [friends, setFriends] = useState<FriendStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/trips/${eventId}/friends-status`)
      if (res.ok) setFriends(await res.json())
    } catch {}
    setLoading(false)
  }, [apiFetch, eventId])

  useEffect(() => { load() }, [load])

  const invite = async (userId: number) => {
    setActing(userId)
    try {
      await apiFetch(`/api/trips/${eventId}/invite`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      })
      await load()
    } catch {}
    setActing(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 border border-white/20 space-y-4 max-h-[70vh] flex flex-col"
        style={{ background: 'linear-gradient(to bottom, #0d2a5e, #0a0f2e)' }}
        onClick={e => e.stopPropagation()}>

        <div className="flex justify-between items-center flex-shrink-0">
          <div>
            <h3 className="text-white font-bold">Invite to {eventName}</h3>
            <p className="text-white/40 text-xs mt-0.5">Choose friends to invite</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-lg leading-none transition-colors">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 -mx-1 px-1">
          {loading && (
            <p className="text-white/30 text-sm text-center py-8 animate-pulse">Loading…</p>
          )}
          {!loading && friends.length === 0 && (
            <div className="text-center py-8 text-white/30">
              <p className="text-3xl mb-2">👥</p>
              <p className="text-sm">No friends yet</p>
              <p className="text-xs mt-1 text-white/20">Add friends from the bell icon on the home screen</p>
            </div>
          )}
          {friends.map(f => {
            const busy = acting === f.id
            return (
              <div key={f.id}
                className="flex items-center gap-3 bg-white/10 rounded-xl p-3 border border-white/15">
                <div className="w-9 h-9 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-300 font-bold text-xs">{f.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-semibold truncate">{f.name}</p>
                  <p className="text-white/40 text-xs truncate">{f.email}</p>
                </div>
                {f.status === 'member' && (
                  <span className="text-green-400 text-xs font-semibold flex-shrink-0">Going ✓</span>
                )}
                {f.status === 'invited' && (
                  <span className="text-yellow-400/70 text-xs flex-shrink-0">Invited</span>
                )}
                {f.status === 'none' && (
                  <button onClick={() => invite(f.id)} disabled={busy}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex-shrink-0 ${
                      busy ? 'opacity-40 pointer-events-none bg-blue-600 text-white' :
                             'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}>
                    {busy ? '…' : 'Invite'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city' | 'camping' | 'festival' | 'gig'
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
  going: string
  is_creator: number
  creator_name: string
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
  camping: '🏕️', festival: '🎪', gig: '🎤',
}

const SCENE_LABELS: Record<SceneType, string> = {
  beach: 'Beach / Resort', countryside: 'Countryside', mountains: 'Mountains', city: 'City',
  camping: 'Camping', festival: 'Festival', gig: 'Gig / Concert',
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
  const [leaving, setLeaving] = useState<number | null>(null)
  const [error, setError] = useState('')

  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [shareModal, setShareModal] = useState<{ url: string; names: string[] } | null>(null)
  const [sharing, setSharing] = useState(false)
  const [inviteModal, setInviteModal] = useState<{ id: number; name: string } | null>(null)

  const toggleSelect = (id: number) =>
    setSelectedIds(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleShare = async (ids: number[]) => {
    setSharing(true)
    try {
      const res = await apiFetch('/api/share', { method: 'POST', body: JSON.stringify({ event_ids: ids }) })
      const { token } = await res.json()
      const url = `${window.location.origin}/join/${token}`
      const names = events.filter(e => ids.includes(e.id)).map(e => e.name)
      setShareModal({ url, names })
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

  const handleLeave = async (id: number) => {
    if (!confirm('Leave this trip?')) return
    setLeaving(id)
    try {
      await apiFetch(`/api/events/${id}/leave`, { method: 'DELETE' })
      await loadEvents()
    } catch { /* ignore */ }
    setLeaving(null)
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
                    {/* Invite friends */}
                    <button onClick={() => setInviteModal({ id: event.id, name: event.name })}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                      title="Invite friends">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <line x1="19" y1="8" x2="19" y2="14"/>
                        <line x1="22" y1="11" x2="16" y2="11"/>
                      </svg>
                    </button>
                    {/* Share — available to all members */}
                    <button onClick={() => handleShare([event.id])} disabled={sharing}
                      className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </button>
                    {/* Edit + Delete — creator only */}
                    {event.is_creator === 1 ? (
                      <>
                        <button onClick={() => handleEdit(event)}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        </button>
                        <button onClick={() => handleDelete(event.id)} disabled={deleting === event.id}
                          className="p-2 rounded-lg bg-white/10 hover:bg-red-500/40 transition-colors disabled:opacity-50">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-white/25 text-xs self-center whitespace-nowrap hidden sm:inline">
                          {event.creator_name}'s trip
                        </span>
                        <button onClick={() => handleLeave(event.id)} disabled={leaving === event.id}
                          className="p-2 rounded-lg bg-white/10 hover:bg-red-500/40 transition-colors disabled:opacity-50"
                          title="Leave trip">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white"
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                            <polyline points="16 17 21 12 16 7"/>
                            <line x1="21" y1="12" x2="9" y2="12"/>
                          </svg>
                        </button>
                      </>
                    )}
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
          <ShareModal url={shareModal.url} names={shareModal.names} onClose={() => setShareModal(null)} />
        )}

        {/* Invite modal */}
        {inviteModal && (
          <InviteModal eventId={inviteModal.id} eventName={inviteModal.name} onClose={() => setInviteModal(null)} />
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
              <label className={labelClass}>Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['beach','countryside','mountains','city','camping','festival','gig'] as SceneType[]).map(v => (
                  <button key={v} type="button" onClick={() => setForm(f => ({ ...f, scene_type: v }))}
                    className={toggleBtn(form.scene_type === v)}>
                    {SCENE_ICONS[v]} {SCENE_LABELS[v]}
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

        <p className="text-white/15 text-[10px] text-center mt-8 tabular-nums">
          Built {new Date(__BUILD_TIME__).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
          {' · '}{new Date(__BUILD_TIME__).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </p>

      </div>
    </div>
  )
}
