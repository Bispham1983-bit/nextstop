import { useEffect, useState } from 'react'
import { FlightPath } from '../components/FlightPath'
import { SceneBackground } from '../components/SceneBackground'

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city'
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
    const raw = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(new Date())
    return parseInt(raw, 10)
  } catch {
    return new Date().getHours()
  }
}

function getLocalTime(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: timezone,
    }).format(new Date())
  } catch {
    return ''
  }
}

function countryToFlag(code: string): string {
  if (!code || code.length !== 2) return '📍'
  return [...code.toUpperCase()].map(c => String.fromCodePoint(c.charCodeAt(0) + 127397)).join('')
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

function pad(n: number) { return String(n).padStart(2, '0') }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fetchWeather(setWeather: (w: Weather | null) => void) {
  fetch('/api/weather').then(r => r.json()).then(setWeather).catch(() => {})
}

const TRAVEL_ICON: Record<string, string> = { plane: '✈', car: '🚗', boat: '⛵' }

export function Home() {
  const [event, setEvent] = useState<Event | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [, setMinuteTick] = useState(0)

  useEffect(() => {
    fetch('/api/event')
      .then(r => r.json())
      .then(data => { setEvent(data); setLoading(false) })
      .catch(() => setLoading(false))

    fetchWeather(setWeather)

    const weatherId = setInterval(() => fetchWeather(setWeather), 30 * 60 * 1000)
    const minuteId  = setInterval(() => setMinuteTick(t => t + 1), 60 * 1000)
    return () => { clearInterval(weatherId); clearInterval(minuteId) }
  }, [])

  useEffect(() => {
    if (!event) return
    const tick = () => setTimeLeft(calculateTimeLeft(event.departure_date))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [event])

  const progress    = event ? calculateProgress(event.booking_date, event.departure_date) : 0
  const departed    = event ? timeLeft.total <= 0 && new Date(event.departure_date) < new Date() : false
  const hour        = weather ? getDestinationHour(weather.timezone) : new Date().getHours()
  const localTime   = weather ? getLocalTime(weather.timezone) : ''
  const sunriseHour = weather ? parseInt(weather.sunrise.split('T')[1], 10) : 6
  const sunsetHour  = weather ? parseInt(weather.sunset.split('T')[1], 10) : 19
  const tropical    = weather ? weather.temperature >= 20 : false
  const destFlag    = weather?.country ? countryToFlag(weather.country) : '📍'
  const travelMode  = (event?.travel_mode ?? 'plane') as TravelMode
  const travelIcon  = TRAVEL_ICON[travelMode] ?? '✈'

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center px-4 py-6">

      <SceneBackground hour={hour} weatherCode={weather?.weather_code ?? 0}
        sunriseHour={sunriseHour} sunsetHour={sunsetHour} tropical={tropical}
        sceneType={(event?.scene_type as SceneType) ?? 'beach'} />

      <div className="relative z-10 w-full max-w-md text-center text-white">

        <p className="text-xs font-semibold tracking-[0.35em] uppercase text-white/80 mb-5"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.5)' }}>
          {travelIcon}&nbsp;&nbsp;Next Stop
        </p>

        {loading && (
          <p className="text-white/50 text-lg animate-pulse">Loading...</p>
        )}

        {!loading && !event && (
          <div className="space-y-4">
            <p className="text-3xl font-bold text-white/60">No adventure set yet</p>
            <a href="/admin" className="text-sm text-white/50 underline underline-offset-4">Add your next trip →</a>
          </div>
        )}

        {!loading && event && (
          <>
            <h1 className="text-6xl sm:text-7xl font-black tracking-tight leading-none mb-1 drop-shadow-lg">
              {event.name}
            </h1>
            <p className="text-white/50 text-sm font-medium mb-5 tracking-wide drop-shadow">
              {event.location}
            </p>

            {/* Weather card */}
            {weather && (
              <div className="rounded-xl border border-white/20 mb-5 overflow-hidden text-left" style={{
                background: 'rgba(0,0,0,0.5)',
                backdropFilter: 'blur(16px)',
              }}>
                {/* Current conditions */}
                <div className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="text-2xl leading-none">{weatherEmoji(weather.weather_code)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xl font-black">{weather.temperature}°C</span>
                      <span className="text-white/50 text-xs truncate">{weatherDesc(weather.weather_code)}</span>
                    </div>
                    <p className="text-white/80 text-[10px] mt-0.5 truncate">
                      📍 {weather.location_name} · {localTime}
                    </p>
                  </div>
                </div>

                {/* Stats bar */}
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

                {/* 5-day forecast */}
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

            {departed ? (
              <div className="my-10 space-y-3">
                <p className="text-5xl">🌴</p>
                <p className="text-2xl font-bold drop-shadow">You're there!</p>
                <p className="text-white/60 text-sm">Have an amazing trip!</p>
              </div>
            ) : (
              <>
                {/* Countdown */}
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
                      <div className="text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-white/80 mt-1.5">
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Travel path */}
                <div className="mb-4">
                  <FlightPath
                    progress={progress}
                    destination={event.destination}
                    travelMode={travelMode}
                    sceneType={(event.scene_type as 'beach' | 'countryside' | 'mountains' | 'city')}
                  />
                </div>

                {/* Dates */}
                <div className="flex justify-between text-[11px] text-white/30 px-1 font-medium">
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
