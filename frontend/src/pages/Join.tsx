import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth, useApiFetch } from '../context/AuthContext'

interface TripPreview {
  name: string
  destination: string
  location: string
  scene_type: string
  travel_mode: string
  departure_date: string
}

const TRAVEL_ICON: Record<string, string> = { plane: '✈', car: '🚗', boat: '⛵' }
const SCENE_ICONS: Record<string, string> = { beach: '🏖️', countryside: '🌄', mountains: '🏔️', city: '🏙️' }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now()
  if (diff < 0) return null
  return Math.ceil(diff / 86400000)
}

export function Join() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const apiFetch = useApiFetch()
  const navigate = useNavigate()

  const [trips, setTrips] = useState<TripPreview[]>([])
  const [sharer, setSharer] = useState('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)

  useEffect(() => {
    fetch(`/api/join/${token}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.events?.length) setNotFound(true)
        else { setTrips(data.events); setSharer(data.sharer ?? '') }
        setLoading(false)
      })
      .catch(() => { setNotFound(true); setLoading(false) })
  }, [token])

  const handleJoin = async () => {
    setJoining(true)
    try {
      const res = await apiFetch(`/api/join/${token}`, { method: 'POST' })
      if (res.ok) {
        setJoined(true)
        setTimeout(() => navigate('/'), 1800)
      }
    } catch {}
    setJoining(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f2e] via-[#0d2a5e] to-[#1a5276] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <p className="text-white/40 text-xs tracking-[0.35em] uppercase mb-2">✈&nbsp;&nbsp;Next Stop</p>
        </div>

        {loading && (
          <p className="text-white/50 text-center animate-pulse">Loading...</p>
        )}

        {notFound && (
          <div className="text-center space-y-3">
            <p className="text-4xl">🤔</p>
            <p className="text-white font-bold text-lg">Link not found</p>
            <p className="text-white/40 text-sm">This invite link may have expired or been removed.</p>
            <a href="/" className="block text-blue-400 hover:text-blue-300 text-sm mt-4 transition-colors">
              Go home →
            </a>
          </div>
        )}

        {!loading && !notFound && trips.length > 0 && (
          <>
            <div className="text-center mb-6">
              <p className="text-white/60 text-sm mb-1">
                {sharer ? <><span className="text-white font-semibold">{sharer}</span> has invited you to join</> : "You've been invited to join"}
              </p>
              <h1 className="text-white text-3xl font-black">
                {trips.length === 1 ? trips[0].name : `${trips.length} trips`}
              </h1>
            </div>

            {/* Trip previews */}
            <div className="space-y-3 mb-6">
              {trips.map((trip, i) => {
                const days = daysUntil(trip.departure_date)
                return (
                  <div key={i} className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/20 flex items-center gap-3">
                    <span className="text-2xl">{SCENE_ICONS[trip.scene_type] ?? '✈️'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold truncate">{trip.name}</p>
                      <p className="text-white/50 text-xs truncate">{trip.location || trip.destination}</p>
                      <p className="text-white/30 text-xs mt-0.5">
                        {TRAVEL_ICON[trip.travel_mode] ?? '✈'} · {formatDate(trip.departure_date)}
                        {days !== null && <span className="ml-1">· {days} day{days !== 1 ? 's' : ''}</span>}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {joined ? (
              <div className="text-center space-y-2">
                <p className="text-3xl">🎉</p>
                <p className="text-white font-bold">Added to your trips!</p>
                <p className="text-white/40 text-sm">Taking you there now...</p>
              </div>
            ) : user ? (
              <>
                <button onClick={handleJoin} disabled={joining}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
                  {joining ? 'Adding...' : `Add to my trips`}
                </button>
                <p className="text-white/30 text-xs text-center mt-3">
                  Signed in as {user.name}
                </p>
              </>
            ) : (
              <>
                <a href={`/login?next=/join/${token}`}
                  className="block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-xl transition-colors text-center">
                  Sign in to add
                </a>
                <a href={`/login?next=/join/${token}`}
                  className="block text-center text-white/40 hover:text-white/60 text-sm mt-3 transition-colors">
                  No account? Create one →
                </a>
              </>
            )}
          </>
        )}

      </div>
    </div>
  )
}
