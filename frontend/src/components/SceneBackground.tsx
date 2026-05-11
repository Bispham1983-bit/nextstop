import { useMemo } from 'react'

type SceneType = 'beach' | 'countryside' | 'mountains' | 'city'
type Slot = 'night' | 'dawn' | 'morning' | 'midday' | 'afternoon' | 'sunset' | 'dusk' | 'rainy' | 'stormy'

interface Props {
  hour: number
  weatherCode: number
  sunriseHour: number
  sunsetHour: number
  tropical: boolean
  sceneType: SceneType
}

const SKY: Record<Slot, string[]> = {
  night:     ['#08052a', '#0f0b38', '#15104a'],
  dawn:      ['#1a0533', '#7c2d12', '#fd7f20', '#fbbf24'],
  morning:   ['#0369a1', '#0ea5e9', '#38bdf8', '#bae6fd'],
  midday:    ['#005f99', '#0096c7', '#00b4d8', '#48cae4'],
  afternoon: ['#0369a1', '#0ea5e9', '#fb923c'],
  sunset:    ['#3d0c02', '#b91c1c', '#ea580c', '#fbbf24'],
  dusk:      ['#1a0a3e', '#3c1361', '#6a0f8e'],
  rainy:     ['#8aa4b4', '#9eb8c4', '#b8cfd8'],
  stormy:    ['#2a3848', '#364456', '#445060'],
}

const SEA_TROPICAL: Record<Slot, string[]> = {
  night:     ['#040d1e', '#020810'],
  dawn:      ['#164e63', '#0c2a3d'],
  morning:   ['#0e7490', '#0369a1'],
  midday:    ['#06b6d4', '#0891b2'],
  afternoon: ['#0ea5e9', '#1d4ed8'],
  sunset:    ['#7c2d12', '#431407'],
  dusk:      ['#0c1445', '#060e2e'],
  rainy:     ['#2a3d50', '#1a2c3c'],
  stormy:    ['#0f1923', '#060d14'],
}

const SEA_TEMPERATE: Record<Slot, string[]> = {
  night:     ['#0a1220', '#050a12'],
  dawn:      ['#1a2e40', '#0d1e2a'],
  morning:   ['#2a5070', '#1a3548'],
  midday:    ['#3a6888', '#2a5070'],
  afternoon: ['#2a5070', '#1a3548'],
  sunset:    ['#3a2010', '#1e1008'],
  dusk:      ['#0a1530', '#050a1a'],
  rainy:     ['#28384a', '#1a2838'],
  stormy:    ['#0d1520', '#080e15'],
}

function getSlot(hour: number, code: number, rise: number, set: number): Slot {
  if (code >= 95) return 'stormy'
  if (code >= 51) return 'rainy'
  if (hour < rise - 1 || hour >= set + 2) return 'night'
  if (hour < rise)       return 'dawn'
  if (hour < rise + 2)   return 'morning'
  if (hour < set - 2)    return 'midday'
  if (hour < set)        return 'afternoon'
  if (hour < set + 1)    return 'sunset'
  return 'dusk'
}

function skyGradient(colors: string[]): string {
  return `linear-gradient(to bottom, ${colors.map((c, i) =>
    `${c} ${Math.round(i / (colors.length - 1) * 100)}%`).join(', ')})`
}

interface SunState { x: number; y: number; r: number; color: string; glow: string; isMoon: boolean }

function getSun(hour: number, rise: number, set: number): SunState {
  if (hour < rise - 0.5 || hour >= set + 1) {
    return { x: 78, y: 12, r: 13, color: '#f5f3e0', glow: 'rgba(245,243,224,0.2)', isMoon: true }
  }
  const t = Math.max(0, Math.min(1, (hour - rise) / (set - rise)))
  const x = 8 + t * 84
  const y = Math.max(10, 57 - 49 * Math.sin(Math.PI * t))
  const warm = t < 0.18 || t > 0.82
  return {
    x, y, r: 24,
    color: warm ? '#ff8c42' : '#fffde7',
    glow:  warm ? 'rgba(255,140,66,0.45)' : 'rgba(255,253,231,0.5)',
    isMoon: false,
  }
}

function Cloud({ opacity }: { opacity: number }) {
  return (
    <div style={{ opacity, position: 'relative', width: 80, height: 28 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'white', borderRadius: 14 }} />
      <div style={{ position: 'absolute', width: 38, height: 38, top: -19, left: 10, background: 'white', borderRadius: '50%' }} />
      <div style={{ position: 'absolute', width: 28, height: 28, top: -12, left: 42, background: 'white', borderRadius: '50%' }} />
    </div>
  )
}

// Cloud path from SVG Repo (basic-cloud). viewBox cropped to content: "0 88 506 328"
const CLOUD_D = 'M396.007,191.19c-0.478,0-1.075,0-1.554,0c-6.693-54.147-52.833-96.103-108.773-96.103c-48.171,0-89.051,31.078-103.753,74.349c-16.734-8.128-35.381-12.67-55.224-12.67C56.658,156.765,0,213.542,0,283.707c0,67.416,52.594,122.64,118.934,126.703v0.239h277.91c60.244-0.358,108.893-49.366,108.893-109.729C505.617,240.317,456.609,191.19,396.007,191.19z'

function RainCloud({ width = 130, opacity = 1, stormy = false }: { width?: number; opacity?: number; stormy?: boolean }) {
  // Original path bounding box: x 0–506, y 88–416 → aspect ~506:328
  const cloudH = Math.round(width * (328 / 506))
  const fill   = stormy ? 'rgba(38,50,66,0.96)' : 'rgba(78,98,118,0.88)'
  const streak = stormy ? 'rgba(115,158,200,0.75)' : 'rgba(155,200,232,0.80)'
  const count  = stormy ? 10 : 7
  const speed  = stormy ? 0.55 : 0.88
  return (
    <div style={{ opacity, position: 'relative', width, height: cloudH + 50 }}>
      <svg viewBox="0 88 506 328" width={width} height={cloudH} style={{ display: 'block' }}>
        <path d={CLOUD_D} fill={fill} />
      </svg>
      {/* Rain streaks drop from cloud base */}
      {Array.from({ length: count }, (_, i) => (
        <div key={i} style={{
          position: 'absolute',
          top: cloudH + 2,
          left: Math.round(8 + (i / (count - 1)) * (width - 20)),
          width: 2,
          height: stormy ? 20 : 15,
          background: streak,
          borderRadius: 2,
          animation: `rain-streak ${speed}s linear infinite ${((i * 0.11) % speed).toFixed(2)}s`,
        }} />
      ))}
    </div>
  )
}

function Waves({ color, horizonColor }: { color: string; horizonColor: string }) {
  // p1fill / p2fill: filled wave shapes. p1crest: just the top edge of p1 for the horizon glow stroke.
  const p1fill  = 'M0,22 C180,6 360,38 540,22 C720,6 900,38 1080,22 C1260,6 1440,38 1620,22 C1800,6 1980,38 2160,22 L2160,55 L0,55Z'
  const p1crest = 'M0,22 C180,6 360,38 540,22 C720,6 900,38 1080,22 C1260,6 1440,38 1620,22 C1800,6 1980,38 2160,22'
  const p2fill  = 'M0,30 C150,14 300,44 540,30 C780,16 900,44 1080,30 C1260,16 1410,44 1620,30 C1830,16 1980,44 2160,30 L2160,55 L0,55Z'
  return (
    /* id="beach-waves" — controls the animated wave band at the horizon */
    <div id="beach-waves" style={{ position: 'absolute', top: -30, left: 0, right: 0, height: 55, overflow: 'visible' }}>
      <svg viewBox="0 0 2160 55" style={{ width: '200%', height: '100%', animation: 'wave-drift 9s linear infinite', opacity: 0.7 }} preserveAspectRatio="none">
        <path d={p1fill} fill={color} />
        {/* Horizon glow — rides exactly on the wave crest, animates with it */}
        <path d={p1crest} fill="none" stroke={horizonColor} strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      </svg>
      <svg viewBox="0 0 2160 55" style={{ position: 'absolute', inset: 0, width: '200%', height: '100%', animation: 'wave-drift 14s linear infinite reverse', opacity: 0.45 }} preserveAspectRatio="none">
        <path d={p2fill} fill={color} />
      </svg>
    </div>
  )
}


function Beach({ slot, tropical, sunX }: { slot: Slot; tropical: boolean; sunX: number }) {
  const SEA = tropical ? SEA_TROPICAL : SEA_TEMPERATE
  const sandLight = tropical ? '#f5d878' : '#e8d4b0'
  const wetSand   = tropical ? '#c8a84a' : '#bfa882'
  const foam      = 'rgba(255,255,255,0.72)'
  const horizonColor = slot === 'night' ? 'rgba(100,140,200,0.45)'
    : slot === 'sunset' || slot === 'dawn' ? 'rgba(255,210,130,0.7)'
    : 'rgba(210,245,255,0.85)'
  return (
    /* id="beach-scene" — outer container, controls how tall the whole beach+sea section is (height %) */
    <div id="beach-scene" className="absolute bottom-0 left-0 right-0" style={{ height: '44%' }}>

      {/* id="beach-sea" — sea gradient fill behind everything */}
      <div id="beach-sea" style={{ position: 'absolute', inset: 0, background: `linear-gradient(to bottom, ${SEA[slot][0]}, ${SEA[slot][1]})` }} />

      {/* id="beach-sea-depth" — colour depth bands: lighter near surface, darker below */}
      <div id="beach-sea-depth" style={{ position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 20%, transparent 45%, rgba(0,0,0,0.08) 70%, rgba(0,0,0,0.18) 100%)'
      }} />

      {/* id="beach-sea-texture" — animated ripple lines at different depths & speeds */}
      {[
        { top: '8%',  dur: '7s',  opacity: 0.13, delay: '0s'    },
        { top: '22%', dur: '11s', opacity: 0.10, delay: '1.5s'  },
        { top: '38%', dur: '15s', opacity: 0.08, delay: '3s'    },
        { top: '54%', dur: '19s', opacity: 0.06, delay: '0.8s'  },
        { top: '70%', dur: '23s', opacity: 0.04, delay: '2.2s'  },
      ].map(({ top, dur, opacity, delay }, i) => (
        <div key={i} style={{ position: 'absolute', top, left: 0, right: 0, height: 12, overflow: 'hidden', pointerEvents: 'none' }}>
          <svg viewBox="0 0 1600 12" style={{ width: '200%', height: '100%', opacity,
            animation: `ripple-drift ${dur} linear infinite ${delay}` }} preserveAspectRatio="none">
            <path d="M0,6 C100,2 200,10 400,6 C600,2 700,10 900,6 C1100,2 1200,10 1400,6 C1500,2 1560,10 1600,6"
              fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      ))}

      {/* Waves component — animated wave band at the horizon; horizon glow is baked into this */}
      <Waves color={SEA[slot][0]} horizonColor={horizonColor} />

      {/* id="beach-shore" — wavy sand section; height % controls how much sand vs sea is visible */}
      <svg id="beach-shore" viewBox="0 0 800 140" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%', height: '40%' }}>
        {/* id="shore-wet-sand" — darker wet sand strip just above the waterline */}
        <path id="shore-wet-sand" d="M0,48 C90,28 200,62 340,40 C460,18 570,52 700,34 C748,24 778,40 800,30 L800,140 L0,140Z" fill={wetSand} />
        {/* id="shore-foam" — bright white foam at the exact water/sand boundary */}
        <path id="shore-foam" d="M0,48 C90,28 200,62 340,40 C460,18 570,52 700,34 C748,24 778,40 800,30
                 C778,36 748,28 700,38 C570,56 460,22 340,44 C200,66 90,32 0,52Z" fill={foam} />
        {/* id="shore-dry-sand" — main bright sand colour */}
        <path id="shore-dry-sand" d="M0,68 C100,46 220,78 370,56 C510,34 630,68 760,50 C780,44 792,54 800,48 L800,140 L0,140Z" fill={sandLight} />
      </svg>

      {/* id="beach-sun-shimmer" — sun glint on the water surface */}
      {slot !== 'night' && slot !== 'dusk' && (
        <div id="beach-sun-shimmer" style={{
          position: 'absolute', left: `${sunX}%`, top: '5%',
          width: '28%', height: '55%', transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.13) 0%, transparent 70%)',
        }} />
      )}
    </div>
  )
}

function Countryside({ slot }: { slot: Slot }) {
  const night = slot === 'night' || slot === 'dusk'
  const wet   = slot === 'rainy' || slot === 'stormy'
  const far  = night ? '#152515' : wet ? '#2a3d2a' : '#3a6b3a'
  const mid  = night ? '#1a2e1a' : wet ? '#334833' : '#4d7d4d'
  const near = night ? '#1f361f' : wet ? '#3c543c' : '#5f9a5f'
  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: '40%' }}>
      <svg viewBox="0 0 800 200" className="w-full h-full" preserveAspectRatio="none">
        <path d="M0,95 Q130,42 280,72 Q420,102 560,50 Q670,20 800,60 L800,200 L0,200Z" fill={far} />
        <path d="M0,135 Q100,88 230,112 Q370,138 500,90 Q625,55 800,100 L800,200 L0,200Z" fill={mid} />
        <path d="M0,168 Q120,128 260,152 Q400,176 535,138 Q665,102 800,148 L800,200 L0,200Z" fill={near} />
      </svg>
    </div>
  )
}

function Mountains({ slot }: { slot: Slot }) {
  const night = slot === 'night' || slot === 'dusk'
  const wet   = slot === 'rainy' || slot === 'stormy'
  const far  = night ? '#1a2030' : wet ? '#3a4555' : '#4a5568'
  const near = night ? '#1f2838' : wet ? '#455060' : '#5a6880'
  const snowy = slot !== 'sunset' && slot !== 'rainy' && slot !== 'stormy'
  // Three smooth far peaks, two large near peaks — all cubic bezier
  const FAR  = 'M0,265 C40,255 75,235 115,210 C150,185 175,155 210,108 C242,155 268,192 308,212 C348,185 382,148 430,92 C474,148 505,192 545,212 C580,175 615,140 655,110 C690,145 722,185 768,210 L800,215 L800,300 L0,300Z'
  const NEAR = 'M0,292 C40,282 80,262 130,248 C175,224 205,188 252,145 C292,190 326,232 375,252 C418,220 458,176 530,130 C596,176 632,220 682,248 C722,232 762,218 800,212 L800,300 L0,300Z'
  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: '52%' }}>
      <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
        <defs>
          <clipPath id="mtn-far-clip"><path d={FAR} /></clipPath>
        </defs>
        <path d={FAR}  fill={far} />
        <path d={NEAR} fill={near} />
        {/* Snow caps — ellipses clipped to mountain body so they don't float in sky */}
        {snowy && [[210,108,38,32],[430,92,44,36],[655,110,34,28]].map(([cx,cy,rx,ry], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={rx} ry={ry}
            fill="rgba(228,238,255,0.90)" clipPath="url(#mtn-far-clip)" />
        ))}
      </svg>
    </div>
  )
}

// [x, width, height, spireH]  — all heights from the bottom (y=300 in viewBox)
const CITY_BLDGS: [number, number, number, number][] = [
  [0,   48,  52, 0],
  [53,  38,  70, 0],
  [96,  42,  88, 0],
  [143, 52, 108, 0],
  [200, 44, 132, 0],
  [249, 48, 168, 24], // tall with spire
  [302, 62, 148,  0],
  [369, 52, 162, 22], // tall with spire
  [426, 46, 130,  0],
  [477, 38, 108,  0],
  [520, 46,  92,  0],
  [571, 44,  78,  0],
  [620, 50,  62,  0],
  [675, 46,  50,  0],
  [726, 38,  42,  0],
  [769, 31,  36,  0],
]

function City({ slot }: { slot: Slot }) {
  const night = slot === 'night' || slot === 'dusk'
  const wet   = slot === 'rainy' || slot === 'stormy'
  const far   = night ? '#0c1525' : wet ? '#1e2b3a' : '#2a3852'
  const near  = night ? '#0a1520' : wet ? '#151e2c' : '#1e293a'
  const gnd   = night ? '#060c14' : wet ? '#0d1520' : '#111c28'
  const winLit = 'rgba(255,228,90,0.82)'
  const winDim = 'rgba(160,200,255,0.18)'
  const GY = 300

  return (
    <div className="absolute bottom-0 left-0 right-0" style={{ height: '48%' }}>
      <svg viewBox="0 0 800 300" className="w-full h-full" preserveAspectRatio="none">
        {/* Far skyline — single path for depth */}
        <path d="M0,300 L0,218 L28,218 L28,198 L58,198 L58,212 L88,212 L88,188 L118,188 L118,202 L148,202 L148,185 L178,185 L178,198 L208,198 L208,180 L238,180 L238,192 L268,192 L268,170 L298,170 L298,184 L328,184 L328,166 L358,166 L358,180 L388,180 L388,165 L418,165 L418,178 L448,178 L448,164 L478,164 L478,178 L508,178 L508,166 L538,166 L538,180 L568,180 L568,172 L598,172 L598,185 L628,185 L628,196 L658,196 L658,184 L688,184 L688,194 L718,194 L718,206 L748,206 L748,216 L778,216 L778,220 L800,220 L800,300Z" fill={far} />

        {/* Near buildings — explicit rects so windows align perfectly */}
        {CITY_BLDGS.map(([x, w, h, sh], bi) => {
          const top = GY - h
          const cols = Math.max(1, Math.floor((w - 10) / 13))
          const rows = Math.max(0, Math.floor((h - 14) / 17))
          return (
            <g key={bi}>
              <rect x={x} y={top} width={w} height={h} fill={near} />
              {sh > 0 && (
                <path d={`M${x + w * 0.28},${top} L${x + w * 0.5},${top - sh} L${x + w * 0.72},${top}Z`}
                  fill={near} />
              )}
              {night && (() => {
                const wins = []
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < cols; c++) {
                    const lit = (bi * 7 + r * 5 + c * 3) % 11 > 3
                    wins.push(
                      <rect key={`${r}-${c}`}
                        x={x + 5 + c * 13} y={top + 8 + r * 17}
                        width="7" height="6"
                        fill={lit ? winLit : winDim} />
                    )
                  }
                }
                return wins
              })()}
            </g>
          )
        })}

        {/* Ground strip */}
        <rect x="0" y={GY - 16} width="800" height="16" fill={gnd} />
        {/* Subtle street glow at night */}
        {night && <rect x="0" y={GY - 24} width="800" height="14" fill="rgba(255,185,50,0.05)" />}
      </svg>
    </div>
  )
}

export function SceneBackground({ hour, weatherCode, sunriseHour, sunsetHour, tropical, sceneType }: Props) {
  const slot = getSlot(hour, weatherCode, sunriseHour, sunsetHour)
  const sun  = getSun(hour, sunriseHour, sunsetHour)
  const showStars   = slot === 'night' || slot === 'dawn' || slot === 'dusk'
  const cloudOpacity = weatherCode === 0 ? 0.25 : weatherCode <= 2 ? 0.52 : weatherCode === 3 ? 0.82 : 0.75

  const stars = useMemo(() =>
    Array.from({ length: 65 }, (_, i) => ({
      id: i,
      top:  ((i * 37 + 11) % 55) + '%',
      left: ((i * 53 +  7) % 100) + '%',
      size: (i % 3) + 1,
      opacity: 0.25 + (i % 5) * 0.12,
    })), []
  )

  return (
    /* id="scene-bg" — full-screen background wrapper; background style = sky gradient */
    <div id="scene-bg" className="fixed inset-0 overflow-hidden" style={{ background: skyGradient(SKY[slot]) }}>

      {/* id="scene-stars" — star dots, only visible at night/dawn/dusk */}
      {showStars && stars.map(s => (
        <div key={s.id} className="absolute rounded-full bg-white"
          style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: s.opacity }} />
      ))}

      {/* id="scene-sun" — sun or moon disc; top % controls vertical position, left % tracks time of day */}
      <div id="scene-sun" className="absolute" style={{
        left: `${sun.x}%`, top: `${sun.y}%`,
        width: sun.r * 2, height: sun.r * 2,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: sun.color,
        boxShadow: `0 0 ${sun.r * 2}px ${sun.r}px ${sun.glow}, 0 0 ${sun.r * 6}px ${sun.r * 3}px ${sun.glow}`,
      }} />

      {/* id="scene-clouds-fair" — fair-weather drifting clouds; cloudOpacity driven by weather code */}
      {slot !== 'stormy' && slot !== 'rainy' && (
        <div id="scene-clouds-fair">
          {/* id="cloud-a" — small cloud, left side */}
          <div id="cloud-a" style={{ position: 'absolute', top: '13%', left: '12%', animation: 'cloud-drift 70s linear infinite' }}>
            <Cloud opacity={cloudOpacity} />
          </div>
          {/* id="cloud-b" — large cloud, centre-right */}
          <div id="cloud-b" style={{ position: 'absolute', top: '8%', left: '52%', animation: 'cloud-drift 95s linear infinite 25s' }}>
            <div style={{ transform: 'scale(1.4)', transformOrigin: 'left top' }}>
              <Cloud opacity={cloudOpacity * 0.7} />
            </div>
          </div>
          {/* id="cloud-c" — small cloud, far right */}
          <div id="cloud-c" style={{ position: 'absolute', top: '20%', left: '72%', animation: 'cloud-drift 82s linear infinite 50s' }}>
            <div style={{ transform: 'scale(0.72)', transformOrigin: 'left top' }}>
              <Cloud opacity={cloudOpacity * 0.5} />
            </div>
          </div>
        </div>
      )}

      {/* id="scene-clouds-rain" — rain/storm clouds with animated streaks */}
      {(slot === 'rainy' || slot === 'stormy') && (
        <div id="scene-clouds-rain">
          <div id="rain-cloud-a" style={{ position: 'absolute', top: '6%', left: '-2%', animation: 'cloud-drift 55s linear infinite' }}>
            <RainCloud width={130} opacity={0.92} stormy={slot === 'stormy'} />
          </div>
          <div id="rain-cloud-b" style={{ position: 'absolute', top: '3%', left: '38%', animation: 'cloud-drift 75s linear infinite 18s' }}>
            <RainCloud width={160} opacity={0.88} stormy={slot === 'stormy'} />
          </div>
          <div id="rain-cloud-c" style={{ position: 'absolute', top: '14%', left: '70%', animation: 'cloud-drift 62s linear infinite 36s' }}>
            <RainCloud width={115} opacity={0.80} stormy={slot === 'stormy'} />
          </div>
          <div id="rain-cloud-d" style={{ position: 'absolute', top: '1%', left: '78%', animation: 'cloud-drift 80s linear infinite 8s' }}>
            <RainCloud width={140} opacity={0.75} stormy={slot === 'stormy'} />
          </div>
        </div>
      )}

      {/* Terrain — only one renders at a time based on sceneType */}
      {sceneType === 'countryside' && <Countryside slot={slot} />}
      {sceneType === 'mountains'   && <Mountains   slot={slot} />}
      {sceneType === 'beach'       && <Beach slot={slot} tropical={tropical} sunX={sun.x} />}
      {sceneType === 'city'        && <City  slot={slot} />}

    </div>
  )
}
