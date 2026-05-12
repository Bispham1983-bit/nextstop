import { useCallback, useEffect, useState } from 'react'
import { useApiFetch } from '../context/AuthContext'

interface FriendRequest {
  id: number
  requester_id: number
  requester_name: string
  requester_email: string
  created_at: number
}

interface TripInvite {
  id: number
  event_id: number
  event_name: string
  from_user_id: number
  from_user_name: string
  created_at: number
}

interface NotificationData {
  items: Array<
    | ({ type: 'friend_request' } & FriendRequest)
    | ({ type: 'trip_invite' } & TripInvite)
  >
  count: number
}

interface Friend {
  id: number
  name: string
  email: string
  status: 'accepted'
}

interface SearchResult {
  id: number
  name: string
  email: string
  friendship_id: number | null
  friendship_status: string | null
  is_addressee: number | null
}

interface FriendListData {
  friends: Friend[]
  sent: Array<{ id: number; name: string; email: string; friendship_id: number }>
  received: FriendRequest[]
}

export function NotificationsPanel({ onClose, onCountChange }: {
  onClose: () => void
  onCountChange: () => void
}) {
  const apiFetch = useApiFetch()
  const [notifs, setNotifs] = useState<NotificationData>({ items: [], count: 0 })
  const [friends, setFriends] = useState<FriendListData>({ friends: [], sent: [], received: [] })
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [actingId, setActingId] = useState<number | null>(null)
  const [tab, setTab] = useState<'notifs' | 'friends'>('notifs')

  const loadNotifs = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications')
      if (!res.ok) return
      const data: NotificationData = await res.json()
      setNotifs(data)
      onCountChange()
    } catch {}
  }, [apiFetch, onCountChange])

  const loadFriends = useCallback(async () => {
    try {
      const res = await apiFetch('/api/friends')
      if (!res.ok) return
      setFriends(await res.json())
    } catch {}
  }, [apiFetch])

  useEffect(() => {
    loadNotifs()
    loadFriends()
  }, [])

  // Debounced search
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await apiFetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`)
        if (res.ok) setSearchResults(await res.json())
      } catch {}
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const sendFriendRequest = async (userId: number) => {
    setActingId(userId)
    try {
      await apiFetch('/api/friends/request', { method: 'POST', body: JSON.stringify({ addressee_id: userId }) })
      setSearchResults(prev => prev.map(r =>
        r.id === userId ? { ...r, friendship_status: 'pending', is_addressee: 0 } : r
      ))
      await loadFriends()
    } catch {}
    setActingId(null)
  }

  const acceptFriend = async (id: number) => {
    setActingId(id)
    try {
      await apiFetch(`/api/friends/${id}/accept`, { method: 'PUT' })
      await loadNotifs()
      await loadFriends()
    } catch {}
    setActingId(null)
  }

  const declineFriend = async (id: number) => {
    setActingId(id)
    try {
      await apiFetch(`/api/friends/${id}/decline`, { method: 'PUT' })
      await loadNotifs()
      await loadFriends()
    } catch {}
    setActingId(null)
  }

  const acceptInvite = async (id: number) => {
    setActingId(id)
    try {
      await apiFetch(`/api/invites/${id}/accept`, { method: 'PUT' })
      await loadNotifs()
    } catch {}
    setActingId(null)
  }

  const declineInvite = async (id: number) => {
    setActingId(id)
    try {
      await apiFetch(`/api/invites/${id}/decline`, { method: 'PUT' })
      await loadNotifs()
    } catch {}
    setActingId(null)
  }

  const pillBtn = (color: 'blue' | 'red' | 'ghost', disabled?: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${disabled ? 'opacity-40 pointer-events-none' : ''} ${
      color === 'blue'  ? 'bg-blue-600 hover:bg-blue-500 text-white' :
      color === 'red'   ? 'bg-white/10 hover:bg-red-500/40 text-white/60 hover:text-white' :
                          'bg-white/10 hover:bg-white/20 text-white/60'
    }`

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(5,10,30,0.97)', backdropFilter: 'blur(20px)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 border-b border-white/10">
        <h2 className="text-white font-bold text-lg">Inbox</h2>
        <button onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-0">
        {(['notifs', 'friends'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'
            }`}>
            {t === 'notifs' ? (
              <span className="flex items-center gap-1.5">
                Notifications
                {notifs.count > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {notifs.count > 9 ? '9+' : notifs.count}
                  </span>
                )}
              </span>
            ) : 'Friends'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

        {/* ── NOTIFICATIONS TAB ─────────────────────────────── */}
        {tab === 'notifs' && (
          <>
            {notifs.items.length === 0 && (
              <div className="text-center py-16 text-white/30">
                <p className="text-4xl mb-3">🔔</p>
                <p className="text-sm">You're all caught up!</p>
              </div>
            )}

            {notifs.items.map(item => {
              if (item.type === 'friend_request') {
                const busy = actingId === item.id
                return (
                  <div key={`fr-${item.id}`}
                    className="bg-white/8 rounded-2xl p-4 border border-white/15 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-blue-300 font-bold text-sm">{item.requester_name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.requester_name}</p>
                      <p className="text-white/40 text-xs">Wants to be friends</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => acceptFriend(item.id)} disabled={busy}
                        className={pillBtn('blue', busy)}>Accept</button>
                      <button onClick={() => declineFriend(item.id)} disabled={busy}
                        className={pillBtn('red', busy)}>✕</button>
                    </div>
                  </div>
                )
              }

              if (item.type === 'trip_invite') {
                const busy = actingId === item.id
                return (
                  <div key={`ti-${item.id}`}
                    className="bg-white/8 rounded-2xl p-4 border border-white/15 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-600/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">✈️</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-semibold truncate">{item.event_name}</p>
                      <p className="text-white/40 text-xs">{item.from_user_name} invited you</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => acceptInvite(item.id)} disabled={busy}
                        className={pillBtn('blue', busy)}>Join</button>
                      <button onClick={() => declineInvite(item.id)} disabled={busy}
                        className={pillBtn('red', busy)}>✕</button>
                    </div>
                  </div>
                )
              }

              return null
            })}
          </>
        )}

        {/* ── FRIENDS TAB ──────────────────────────────────── */}
        {tab === 'friends' && (
          <>
            {/* Search */}
            <div className="relative">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find friends by name or email…"
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors text-sm"
              />
            </div>

            {/* Search results */}
            {query.trim() && (
              <div className="space-y-2">
                {searching && (
                  <p className="text-white/30 text-xs text-center py-2 animate-pulse">Searching…</p>
                )}
                {!searching && searchResults.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-2">No users found</p>
                )}
                {searchResults.map(u => {
                  const busy = actingId === u.id
                  const alreadyFriend = u.friendship_status === 'accepted'
                  const pendingSent = u.friendship_status === 'pending' && u.is_addressee === 0
                  const pendingReceived = u.friendship_status === 'pending' && u.is_addressee === 1
                  return (
                    <div key={u.id}
                      className="bg-white/8 rounded-2xl p-3 border border-white/15 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-300 font-bold text-xs">{u.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{u.name}</p>
                        <p className="text-white/40 text-xs truncate">{u.email}</p>
                      </div>
                      {alreadyFriend && (
                        <span className="text-green-400 text-xs font-semibold flex-shrink-0">Friends ✓</span>
                      )}
                      {pendingSent && (
                        <span className="text-white/30 text-xs flex-shrink-0">Sent</span>
                      )}
                      {pendingReceived && (
                        <span className="text-blue-400 text-xs flex-shrink-0">Pending</span>
                      )}
                      {!u.friendship_status && (
                        <button onClick={() => sendFriendRequest(u.id)} disabled={busy}
                          className={pillBtn('blue', busy)}>
                          {busy ? '…' : 'Add'}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pending received requests */}
            {!query.trim() && friends.received.length > 0 && (
              <>
                <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase px-1 pt-2">
                  Requests received
                </p>
                {friends.received.map(r => {
                  const busy = actingId === r.id
                  return (
                    <div key={r.id}
                      className="bg-white/8 rounded-2xl p-3 border border-white/15 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-300 font-bold text-xs">{r.requester_name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{r.requester_name}</p>
                        <p className="text-white/40 text-xs truncate">{r.requester_email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => acceptFriend(r.id)} disabled={busy}
                          className={pillBtn('blue', busy)}>Accept</button>
                        <button onClick={() => declineFriend(r.id)} disabled={busy}
                          className={pillBtn('red', busy)}>✕</button>
                      </div>
                    </div>
                  )
                })}
              </>
            )}

            {/* Pending sent */}
            {!query.trim() && friends.sent.length > 0 && (
              <>
                <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase px-1 pt-2">
                  Requests sent
                </p>
                {friends.sent.map(s => (
                  <div key={s.id}
                    className="bg-white/8 rounded-2xl p-3 border border-white/15 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-white/40 font-bold text-xs">{s.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-sm font-semibold truncate">{s.name}</p>
                      <p className="text-white/30 text-xs truncate">{s.email}</p>
                    </div>
                    <span className="text-white/30 text-xs flex-shrink-0">Pending…</span>
                  </div>
                ))}
              </>
            )}

            {/* Friends list */}
            {!query.trim() && (
              <>
                {friends.friends.length > 0 && (
                  <>
                    <p className="text-white/30 text-[10px] font-semibold tracking-widest uppercase px-1 pt-2">
                      My friends · {friends.friends.length}
                    </p>
                    {friends.friends.map(f => (
                      <div key={f.id}
                        className="bg-white/8 rounded-2xl p-3 border border-white/15 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-green-600/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-300 font-bold text-xs">{f.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-semibold truncate">{f.name}</p>
                          <p className="text-white/40 text-xs truncate">{f.email}</p>
                        </div>
                        <span className="text-green-400/60 text-xs">Friends</span>
                      </div>
                    ))}
                  </>
                )}

                {friends.friends.length === 0 && friends.received.length === 0 && friends.sent.length === 0 && (
                  <div className="text-center py-12 text-white/30">
                    <p className="text-4xl mb-3">👥</p>
                    <p className="text-sm">Search above to find friends</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
