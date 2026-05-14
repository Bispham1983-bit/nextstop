import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react'
import { FlightPath } from '../components/FlightPath'
import { SceneBackground } from '../components/SceneBackground'
import { useAuth, useApiFetch } from '../context/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { useNotificationCount } from '../hooks/useNotificationCount'
import { NotificationsPanel } from './Notifications'

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city' | 'camping' | 'festival' | 'gig'
type TravelMode = 'plane' | 'car' | 'boat'

interface Event {
  id: number
  name: string
  destination: string
  location: string
  scene_type: string
  travel_mode: string
  departure_date: string
  booking_date: string
  going: string       // pipe-separated names e.g. "Sam|Donna|Claire"
  is_creator: number  // 1 or 0
}

function formatGoing(going: string, myName?: string): string | null {
  let names = going ? going.split('|').filter(Boolean) : []
  if (myName) names = names.filter(n => n !== myName)
  if (names.length === 0) return null
  if (names.length === 1) return `Going with ${names[0]}`
  if (names.length === 2) return `Going with ${names[0]} & ${names[1]}`
  return `Going with ${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

interface ForecastDay {
  date: string
  weather_code: number
  temp_max: number
  temp_min: number
}

interface Weather {
  temperature: number
  feels_like: number
  weather_code: number
  wind_speed: number
  humidity: number
  timezone: string
  location_name: string
  country: string
  sunrise: string
  sunset: string
  forecast: ForecastDay[]
}

interface TimeLeft { days: number; hours: number; minutes: number; seconds: number; total: number }

function calculateTimeLeft(departureDate: string): TimeLeft {
  const now = new Date()
  const departure = new Date(departureDate)
  const total = departure.getTime() - now.getTime()
  if (total <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, total }
  return {
    days:    Math.floor(total / 86400000),
    hours:   Math.floor((total % 86400000) / 3600000),
    minutes: Math.floor((total % 3600000) / 60000),
    seconds: Math.floor((total % 60000) / 1000),
    total,
  }
}

function calculateProgress(bookingDate: string, departureDate: string): number {
  const now = Date.now()
  const booking = new Date(bookingDate).getTime()
  const departure = new Date(departureDate).getTime()
  if (now <= booking) return 0
  if (now >= departure) return 1
  return (now - booking) / (departure - booking)
}

function getDestinationHour(timezone: string): number {
  try {
    return parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(new Date()), 10)
  } catch { return new Date().getHours() }
}

function getLocalTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone }).format(new Date())
  } catch { return '' }
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

function weatherDesc(code: number): string {
  if (code === 0) return 'Clear sky'
  if (code <= 2) return 'Partly cloudy'
  if (code === 3) return 'Overcast'
  if (code <= 48) return 'Foggy'
  if (code <= 55) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  return 'Thunderstorm'
}

function forecastDayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'Today'
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}


function DepartureAnimation({ travelMode }: { travelMode: string }) {
  const keyframes = `
    @keyframes ns-takeoff {
      0%   { transform: translate(0px, 0px) rotate(0deg);    opacity: 0; }
      8%   { opacity: 1; }
      65%  { transform: translate(100px, -140px) rotate(-22deg); opacity: 1; }
      82%  { transform: translate(180px, -240px) rotate(-28deg); opacity: 0; }
      83%  { transform: translate(0px, 0px) rotate(0deg);    opacity: 0; }
      100% { transform: translate(0px, 0px) rotate(0deg);    opacity: 0; }
    }
    @keyframes ns-drive {
      0%   { transform: translateX(-90px); opacity: 0; }
      8%   { opacity: 1; }
      88%  { opacity: 1; }
      100% { transform: translateX(calc(100vw + 20px)); opacity: 0; }
    }
    @keyframes ns-sail {
      0%   { transform: translate(-90px,  0px); opacity: 0; }
      8%   { opacity: 1; }
      30%  { transform: translate(calc(28vw - 90px), -10px); }
      55%  { transform: translate(calc(55vw - 90px),   6px); }
      78%  { transform: translate(calc(78vw - 90px),  -8px); }
      90%  { opacity: 1; }
      100% { transform: translate(calc(100vw + 20px), 0px); opacity: 0; }
    }
  `
  const emoji = travelMode === 'car' ? '🚗' : travelMode === 'boat' ? '⛵' : '✈️'
  const anim  = travelMode === 'car'  ? 'ns-drive 3s linear infinite' :
                travelMode === 'boat' ? 'ns-sail 3.8s ease-in-out infinite' :
                                        'ns-takeoff 3.2s ease-in infinite'
  const style: React.CSSProperties = travelMode === 'plane'
    ? { position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 52, lineHeight: 1, animation: anim }
    : { position: 'absolute', bottom: 8, left: 0,                                    fontSize: 52, lineHeight: 1, animation: anim }

  return (
    <>
      <style>{keyframes}</style>
      <div style={{ position: 'relative', width: '100%', height: 72, overflow: 'hidden' }}>
        <div style={style}>{emoji}</div>
      </div>
    </>
  )
}

function pad(n: number) { return String(n).padStart(2, '0') }
function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const TRAVEL_ICON: Record<string, string> = { plane: '✈', car: '🚗', boat: '⛵' }

const SCENE_GRAD: Record<string, string> = {
  beach:       'linear-gradient(150deg, #005f99 0%, #0096c7 45%, #06b6d4 100%)',
  countryside: 'linear-gradient(150deg, #0369a1 0%, #2d5a2d 55%, #4d7d4d 100%)',
  mountains:   'linear-gradient(150deg, #0c2a4a 0%, #4a5568 55%, #6b7a90 100%)',
  city:        'linear-gradient(150deg, #060d1e 0%, #1a2540 50%, #2a3852 100%)',
  camping:     'linear-gradient(150deg, #0a1f0a 0%, #1a3d1a 50%, #2d5a2d 100%)',
  festival:    'linear-gradient(150deg, #4a0080 0%, #9c27b0 45%, #e65c00 100%)',
  gig:         'linear-gradient(150deg, #0a000f 0%, #1a0030 50%, #0f0020 100%)',
}

function daysUntil(dateStr: string): { n: number; label: string; departed: boolean; isToday: boolean } {
  const msSince = Date.now() - new Date(dateStr).getTime()
  if (msSince >= 86400000) return { n: 0, label: 'Past', departed: true, isToday: false }
  if (msSince >= 0)        return { n: 0, label: 'Today!', departed: false, isToday: true }
  const n = Math.ceil(-msSince / 86400000)
  return { n, label: n === 1 ? 'day' : 'days', departed: false, isToday: false }
}

function TripGrid({ events, weatherMap, onSelect, myName }: { events: Event[]; weatherMap: Record<string, Weather>; onSelect: (i: number) => void; myName: string }) {
  return (
    <div className="fixed inset-0 z-30 overflow-y-auto"
      style={{ background: 'rgba(5,10,30,0.97)', backdropFilter: 'blur(20px)' }}>
      <div className="px-4 pt-14 pb-8 max-w-lg mx-auto">
        <p className="text-white/50 text-xs font-semibold tracking-[0.3em] uppercase text-center mb-6">
          All Trips
        </p>
        <div className="flex flex-col gap-3">
          {events.map((event, i) => {
            const { n, label, departed, isToday } = daysUntil(event.departure_date)
            const progress = calculateProgress(event.booking_date, event.departure_date)
            const grad = SCENE_GRAD[event.scene_type] ?? SCENE_GRAD.beach
            const weather = weatherMap[event.location || event.destination] ?? null
            return (
              <button key={event.id} onClick={() => onSelect(i)}
                className="relative rounded-2xl overflow-hidden text-left w-full"
                style={{
                  background: departed ? 'rgba(255,255,255,0.05)' : grad,
                  boxShadow: departed ? 'none' : '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
                  opacity: departed ? 0.6 : 1,
                }}>

                <div className="flex items-center gap-4 px-5 py-4">

                  {/* Countdown */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {isToday ? (
                      <span className="text-2xl">🌴</span>
                    ) : departed ? (
                      <span className="text-xs font-bold text-white/30 uppercase tracking-wider leading-tight">Past</span>
                    ) : (
                      <>
                        <div className="text-5xl font-black text-white leading-none tabular-nums drop-shadow">{n}</div>
                        <div className="text-white/60 text-xs font-semibold mt-0.5">{label}</div>
                      </>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="w-px self-stretch bg-white/20 flex-shrink-0" />

                  {/* Details */}
                  <div className="flex-1 min-w-0 py-0.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-white font-black text-lg leading-tight truncate">{event.name}</p>
                      <span className="text-base flex-shrink-0 opacity-80">{TRAVEL_ICON[event.travel_mode] ?? '✈'}</span>
                    </div>
                    <p className="text-white/60 text-xs truncate mb-2">{event.location || event.destination}</p>

                    {/* Going with */}
                    {formatGoing(event.going, myName) && (
                      <p className="text-white/50 text-xs truncate mb-1">{formatGoing(event.going, myName)}</p>
                    )}

                    {/* Weather */}
                    {weather ? (
                      <p className="text-white/70 text-xs mb-2">
                        {weatherEmoji(weather.weather_code)} {weather.temperature}°C · {weatherDesc(weather.weather_code)}
                      </p>
                    ) : (
                      <p className="text-white/30 text-xs mb-2">Departs {formatDate(event.departure_date)}</p>
                    )}

                    {/* Progress bar */}
                    {!departed && (
                      <div className="h-1 rounded-full bg-white/15 overflow-hidden">
                        <div className="h-full rounded-full bg-white/60 transition-all"
                          style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    )}
                  </div>

                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TopBar({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const { status: notifStatus, enable: enableNotifs } = usePushNotifications()
  const { count, refresh: refreshCount } = useNotificationCount()
  const [menuOpen, setMenuOpen] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)

  return (
    <>
      {/* Bell icon */}
      <button onClick={() => { setShowNotifs(true); setMenuOpen(false) }}
        className="absolute top-4 right-14 z-20 p-2 rounded-full"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
        <div className="relative">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-blue-500 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center leading-none">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </div>
      </button>

      {/* Gear icon */}
      <button onClick={() => setMenuOpen(o => !o)}
        className="absolute top-4 right-4 z-20 p-2 rounded-full"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute top-14 right-4 z-30 rounded-2xl overflow-hidden border border-white/20 min-w-[170px]"
          style={{ background: 'rgba(10,15,46,0.95)', backdropFilter: 'blur(20px)' }}>
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/40 text-xs">Signed in as</p>
            <p className="text-white text-sm font-semibold truncate">{user?.name}</p>
          </div>
          <a href="/admin" onClick={() => setMenuOpen(false)}
            className="flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Manage trips
          </a>
          {notifStatus !== 'denied' && (
            <button onClick={() => { if (notifStatus === 'default') enableNotifs(); setMenuOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm text-left border-t border-white/10">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              {notifStatus === 'granted' ? 'Notifications on ✓' : 'Enable notifications'}
            </button>
          )}
          <button onClick={() => { setMenuOpen(false); onLogout() }}
            className="w-full flex items-center gap-3 px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 transition-colors text-sm text-left border-t border-white/10">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
            </svg>
            Sign out
          </button>
        </div>
      )}

      {/* Notifications panel */}
      {showNotifs && (
        <NotificationsPanel
          onClose={() => setShowNotifs(false)}
          onCountChange={refreshCount}
        />
      )}
    </>
  )
}

function EventSlide({ event, weather, myName }: { event: Event; weather: Weather | null; myName: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })

  useEffect(() => {
    const tick = () => setTimeLeft(calculateTimeLeft(event.departure_date))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event.departure_date])

  const progress   = calculateProgress(event.booking_date, event.departure_date)
  const msSinceDep = Date.now() - new Date(event.departure_date).getTime()
  const isToday    = msSinceDep >= 0 && msSinceDep < 86400000        // within 24h of departure
  const departed   = msSinceDep >= 86400000                          // more than 1 day past
  const localTime  = weather ? getLocalTime(weather.timezone) : ''
  const travelMode = (event.travel_mode ?? 'plane') as TravelMode
  const travelIcon = TRAVEL_ICON[travelMode] ?? '✈'

  return (
    <div className="flex-shrink-0 flex flex-col items-center justify-center px-4 py-10 relative"
      style={{ width: '100vw', height: '100dvh', scrollSnapAlign: 'start' }}>

      <div className="relative z-10 w-full max-w-md text-center text-white">

        <p className="text-xs font-semibold tracking-[0.35em] uppercase text-white/80 mb-5"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
          {travelIcon}&nbsp;&nbsp;Next Stop
        </p>

        <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-1 drop-shadow-lg">
          {event.name}
        </h1>
        <p className="text-white/50 text-sm font-medium tracking-wide drop-shadow">
          {event.location}
        </p>
        {formatGoing(event.going, myName) && (
          <p className="text-white/40 text-xs font-medium mt-1 mb-5 drop-shadow">
            {formatGoing(event.going, myName)}
          </p>
        )}
        {!formatGoing(event.going, myName) && <div className="mb-5" />}

        {/* Weather card */}
        {weather && (
          <div className="rounded-xl border border-white/20 mb-5 overflow-hidden text-left"
            style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <span className="text-2xl leading-none">{weatherEmoji(weather.weather_code)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black">{weather.temperature}°C</span>
                  <span className="text-white/50 text-xs truncate">{weatherDesc(weather.weather_code)}</span>
                </div>
                <p className="text-white/80 text-[10px] mt-0.5 truncate">📍 {weather.location_name} · {localTime}</p>
              </div>
            </div>
            <div className="flex border-t border-white/10 divide-x divide-white/10">
              {[
                { label: 'Feels like', value: `${weather.feels_like}°C` },
                { label: 'Humidity',   value: `${weather.humidity}%` },
                { label: 'Wind',       value: `${weather.wind_speed} mph` },
              ].map(({ label, value }) => (
                <div key={label} className="flex-1 py-1.5 text-center">
                  <p className="text-white/30 text-[8px] uppercase tracking-widest">{label}</p>
                  <p className="text-white font-semibold text-xs">{value}</p>
                </div>
              ))}
            </div>
            {weather.forecast?.length > 0 && (
              <div className="flex border-t border-white/10 divide-x divide-white/10">
                {weather.forecast.slice(0, 5).map((day, i) => (
                  <div key={day.date} className="flex-1 py-2 text-center">
                    <p className="text-white/45 text-[9px] font-semibold uppercase tracking-wide leading-none mb-1">
                      {forecastDayLabel(day.date, i)}
                    </p>
                    <p className="text-xl leading-none mb-1">{weatherEmoji(day.weather_code)}</p>
                    <p className="text-white font-bold text-[10px] leading-none">
                      {day.temp_max}° <span className="text-white/80 font-normal">{day.temp_min}°</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {isToday ? (
          <div className="my-10 space-y-4">
            <DepartureAnimation travelMode={travelMode} />
            <p className="text-4xl font-black drop-shadow">Today's the day!</p>
            <p className="text-white/60 text-sm">Have an amazing trip</p>
          </div>
        ) : departed ? (
          <div className="my-10 space-y-3">
            <p className="text-5xl">📸</p>
            <p className="text-2xl font-bold drop-shadow">Hope it was amazing!</p>
            <p className="text-white/50 text-sm">{event.name}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 sm:gap-3 mb-7">
              {[
                { value: timeLeft.days,    label: 'DAYS' },
                { value: timeLeft.hours,   label: 'HRS' },
                { value: timeLeft.minutes, label: 'MINS' },
                { value: timeLeft.seconds, label: 'SECS' },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-2xl py-4 px-2 border border-white/25" style={{
                  background: 'rgba(0,0,0,0.28)',
                  backdropFilter: 'blur(14px)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.12)',
                }}>
                  <div className="text-4xl sm:text-5xl font-black tabular-nums leading-none tracking-tight drop-shadow">
                    {pad(value)}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-white/80 mt-1.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <FlightPath
                progress={progress}
                destination={event.destination}
                travelMode={travelMode}
                sceneType={(event.scene_type as SceneType)}
              />
            </div>

            <div className="flex justify-between text-[11px] text-white/30 px-1 font-medium">
              <span>Booked {formatDate(event.booking_date)}</span>
              <span>Departs {formatDate(event.departure_date)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function Home() {
  const { logout, user } = useAuth()
  const apiFetch = useApiFetch()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [showGrid, setShowGrid] = useState(false)
  const [weatherMap, setWeatherMap] = useState<Record<string, Weather>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const jumpIndexRef = useRef<number | null>(null)

  useEffect(() => {
    apiFetch('/api/events')
      .then(r => r.json())
      .then(data => { setEvents(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Fetch weather for active event (and prefetch neighbours)
  const fetchWeather = useCallback((event: Event) => {
    const loc = event.location || event.destination
    if (!loc || weatherMap[loc]) return
    apiFetch(`/api/weather?location=${encodeURIComponent(loc)}`)
      .then(r => r.json())
      .then(data => { if (data) setWeatherMap(m => ({ ...m, [loc]: data })) })
      .catch(() => {})
  }, [weatherMap])

  useEffect(() => {
    if (!events.length) return
    fetchWeather(events[activeIndex])
    if (events[activeIndex + 1]) fetchWeather(events[activeIndex + 1])
  }, [activeIndex, events])

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, offsetWidth } = scrollRef.current
    const index = Math.round(scrollLeft / offsetWidth)
    setActiveIndex(Math.max(0, Math.min(index, events.length - 1)))
  }, [events.length])

  const jumpTo = useCallback((i: number) => {
    jumpIndexRef.current = i
    setActiveIndex(i)
    setShowGrid(false)
  }, [])

  // After grid closes, scroll carousel to the selected index instantly
  useLayoutEffect(() => {
    if (showGrid || jumpIndexRef.current === null) return
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: jumpIndexRef.current * el.offsetWidth, behavior: 'instant' as ScrollBehavior })
    jumpIndexRef.current = null
  }, [showGrid])

  const activeEvent  = events[activeIndex] ?? null
  const activeWeather = activeEvent ? (weatherMap[activeEvent.location || activeEvent.destination] ?? null) : null
  const hour         = activeWeather ? getDestinationHour(activeWeather.timezone) : new Date().getHours()
  const sunriseHour  = activeWeather ? parseInt(activeWeather.sunrise.split('T')[1], 10) : 6
  const sunsetHour   = activeWeather ? parseInt(activeWeather.sunset.split('T')[1], 10) : 19
  const tropical     = activeWeather ? activeWeather.temperature >= 20 : false

  return (
    <div className="relative overflow-hidden" style={{ width: '100vw', height: '100dvh' }}>

      <SceneBackground
        hour={hour}
        weatherCode={activeWeather?.weather_code ?? 0}
        sunriseHour={sunriseHour}
        sunsetHour={sunsetHour}
        tropical={tropical}
        sceneType={(activeEvent?.scene_type as SceneType) ?? 'beach'}
      />

      <TopBar onLogout={logout} />

      {/* Grid toggle — only show when there are multiple trips */}
      {events.length > 1 && (
        <button onClick={() => setShowGrid(g => !g)}
          className="absolute top-4 left-4 z-20 p-2 rounded-full"
          style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(8px)' }}>
          {showGrid ? (
            // X to close grid
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)"
              strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          ) : (
            // Grid icon
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
          )}
        </button>
      )}

      {/* Grid overlay */}
      {showGrid && <TripGrid events={events} weatherMap={weatherMap} onSelect={jumpTo} myName={user?.name ?? ''} />}

      {/* Swipeable carousel */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="relative z-10 flex h-full"
        style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>

        {loading && (
          <div className="flex-shrink-0 flex items-center justify-center text-white/50 text-lg animate-pulse"
            style={{ width: '100vw', height: '100dvh', scrollSnapAlign: 'start' }}>
            Loading...
          </div>
        )}

        {!loading && events.length === 0 && (
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-4"
            style={{ width: '100vw', height: '100dvh', scrollSnapAlign: 'start' }}>
            <p className="text-3xl font-bold text-white/60">No adventures yet</p>
            <a href="/admin" className="text-sm text-white/50 underline underline-offset-4">Add your first trip →</a>
          </div>
        )}

        {events.map((event, i) => (
          <EventSlide
            key={event.id}
            event={event}
            weather={weatherMap[event.location || event.destination] ?? null}
            myName={user?.name ?? ''}
          />
        ))}
      </div>

      {/* Dot indicators */}
      {events.length > 1 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20">
          {events.map((_, i) => (
            <div key={i} className="rounded-full transition-all duration-300" style={{
              width:   i === activeIndex ? 20 : 6,
              height:  6,
              background: i === activeIndex ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>
      )}
    </div>
  )
}
