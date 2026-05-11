import { useEffect, useMemo, useState } from 'react'
import { FlightPath } from '../components/FlightPath'

interface Event {
  id: number
  name: string
  destination: string
  departure_date: string
  booking_date: string
}

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
  total: number
}

function calculateTimeLeft(departureDate: string): TimeLeft {
  const now = new Date()
  const departure = new Date(departureDate)
  const total = departure.getTime() - now.getTime()

  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total }

  const days = Math.floor(total / (1000 * 60 * 60 * 24))
  const hours = Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((total % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((total % (1000 * 60)) / 1000)

  return { days, hours, minutes, seconds, total }
}

function calculateProgress(bookingDate: string, departureDate: string): number {
  const now = Date.now()
  const booking = new Date(bookingDate).getTime()
  const departure = new Date(departureDate).getTime()
  if (now <= booking) return 0
  if (now >= departure) return 1
  return (now - booking) / (departure - booking)
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function Home() {
  const [event, setEvent] = useState<Event | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })
  const [loading, setLoading] = useState(true)

  // Deterministic stars so they don't flicker on re-render
  const stars = useMemo(() =>
    Array.from({ length: 70 }, (_, i) => ({
      id: i,
      top: ((i * 37 + 11) % 65) + '%',
      left: ((i * 53 + 7) % 100) + '%',
      size: (i % 3) + 1,
      opacity: 0.3 + (i % 5) * 0.1,
    })), []
  )

  useEffect(() => {
    fetch('/api/event')
      .then(r => r.json())
      .then(data => { setEvent(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!event) return
    const tick = () => setTimeLeft(calculateTimeLeft(event.departure_date))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event])

  const progress = event ? calculateProgress(event.booking_date, event.departure_date) : 0
  const departed = event ? timeLeft.total <= 0 && new Date(event.departure_date) < new Date() : false

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f2e] via-[#0d2a5e] to-[#1a5276] flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">

      {/* Stars */}
      <div className="fixed inset-0 pointer-events-none">
        {stars.map(s => (
          <div
            key={s.id}
            className="absolute rounded-full bg-white"
            style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md text-center text-white">

        {/* Brand */}
        <p className="text-xs font-semibold tracking-[0.35em] uppercase text-blue-300/80 mb-6">
          ✈&nbsp;&nbsp;Next Stop
        </p>

        {loading && (
          <p className="text-blue-300 text-lg animate-pulse">Loading...</p>
        )}

        {!loading && !event && (
          <div className="space-y-4">
            <p className="text-3xl font-bold text-white/60">No adventure set yet</p>
            <a href="/admin" className="text-sm text-blue-400 underline underline-offset-4">
              Add your next trip →
            </a>
          </div>
        )}

        {!loading && event && (
          <>
            {/* Destination */}
            <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-1">
              {event.destination}
            </h1>
            <p className="text-blue-300/70 text-sm font-medium mb-8 tracking-wide">
              {event.name}
            </p>

            {departed ? (
              <div className="my-10 space-y-2">
                <p className="text-4xl">🌴</p>
                <p className="text-2xl font-bold">You're there!</p>
                <p className="text-blue-300 text-sm">Have an amazing trip!</p>
              </div>
            ) : (
              <>
                {/* Countdown tiles */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-10">
                  {[
                    { value: timeLeft.days, label: 'DAYS' },
                    { value: timeLeft.hours, label: 'HRS' },
                    { value: timeLeft.minutes, label: 'MINS' },
                    { value: timeLeft.seconds, label: 'SECS' },
                  ].map(({ value, label }) => (
                    <div
                      key={label}
                      className="bg-white/10 backdrop-blur-sm rounded-2xl py-4 px-2 border border-white/20 shadow-lg"
                      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)' }}
                    >
                      <div className="text-4xl sm:text-5xl font-black tabular-nums leading-none tracking-tight">
                        {pad(value)}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-blue-300/70 mt-1.5">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Flight path */}
                <div className="mb-6">
                  <FlightPath progress={progress} />
                </div>

                {/* Dates row */}
                <div className="flex justify-between text-[11px] text-blue-300/50 px-1 font-medium">
                  <span>Booked {formatDate(event.booking_date)}</span>
                  <span>Departs {formatDate(event.departure_date)}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
