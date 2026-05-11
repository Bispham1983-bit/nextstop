import { useEffect, useRef, useState } from 'react'

type TravelMode = 'plane' | 'car' | 'boat'
type SceneType  = 'beach' | 'countryside' | 'mountains' | 'city'

interface FlightPathProps {
  progress: number
  destination?: string
  travelMode?: TravelMode
  sceneType?: SceneType
}

interface VehiclePos { x: number; y: number; angle: number }

const PATHS: Record<TravelMode, string> = {
  plane: 'M 60,112 Q 300,8 540,112',
  car:   'M 60,112 C 105,112 125,122 170,112 C 215,102 235,122 280,112 C 325,102 345,122 390,112 C 435,102 455,122 500,112 C 515,112 528,112 540,112',
  boat:  'M 60,112 C 110,112 125,118 180,112 C 235,106 250,118 310,112 C 370,106 385,118 445,112 C 500,106 515,118 540,112',
}

const ICON_PROPS = { stroke: 'white', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function HomeIcon() {
  return (
    <g {...ICON_PROPS} transform="scale(1.9)">
      <polyline points="-8,2 0,-8 8,2" />
      <polyline points="-6,2 -6,9 6,9 6,2" />
      <polyline points="-2.5,9 -2.5,4.5 2.5,4.5 2.5,9" />
    </g>
  )
}

function PalmIcon() {
  return (
    <g {...ICON_PROPS} transform="scale(1.9)">
      {/* Trunk — gently curved */}
      <path d="M 0,12 C -1,5 2,-1 1,-8" />
      {/* Fronds — droop downward from crown */}
      <path d="M 1,-8 C 2,-13 6,-15 9,-13" />
      <path d="M 1,-8 C -1,-13 -5,-15 -8,-13" />
      <path d="M 1,-8 C 5,-11 9,-9 11,-6" />
      <path d="M 1,-8 C -3,-11 -7,-9 -9,-6" />
      <path d="M 1,-8 C 1,-13 1,-16 0,-17" />
    </g>
  )
}

function MountainIcon() {
  return (
    <g {...ICON_PROPS} transform="scale(1.9)">
      <polyline points="-12,8 -4,-4 4,8" />
      <polyline points="-1,8 7,-8 15,8" />
    </g>
  )
}

function CityIcon() {
  return (
    <g {...ICON_PROPS} transform="scale(1.9)">
      <polyline points="-11,8 -11,-1 -5,-1 -5,8" />
      <polyline points="-4,8 -4,-8 2,-8 2,8" />
      <polyline points="3,8 3,-3 9,-3 9,8" />
      <line x1="-1" y1="-8" x2="-1" y2="-11" />
    </g>
  )
}

function HillsIcon() {
  return (
    <g {...ICON_PROPS} transform="scale(1.9)">
      <path d="M -13,8 C -9,1 -5,1 -1,5 C 2,1 6,-4 11,0 C 12,1 13,3 14,5" />
    </g>
  )
}

function destIcon(sceneType: SceneType) {
  switch (sceneType) {
    case 'beach':       return <PalmIcon />
    case 'mountains':   return <MountainIcon />
    case 'city':        return <CityIcon />
    case 'countryside': return <HillsIcon />
  }
}

function Pin({ cx, label, children }: { cx: number; label: string; children: React.ReactNode }) {
  const pathY = 112
  const iconCy = 68
  const short = label.length > 10 ? label.slice(0, 10) : label
  return (
    <g>
      <g transform={`translate(${cx},${iconCy})`}
        style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.5))' }}>
        {children}
      </g>
      <text x={cx} y={pathY + 20} textAnchor="middle" dominantBaseline="middle"
        fontSize="18" fill="white" fontWeight="700"
        stroke="rgba(0,0,0,0.6)" strokeWidth="4" paintOrder="stroke"
        fontFamily="Inter, system-ui, sans-serif">
        {short}
      </text>
    </g>
  )
}

export function FlightPath({ progress, destination = 'Dest', travelMode = 'plane', sceneType = 'beach' }: FlightPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const [pos, setPos] = useState<VehiclePos>({ x: 60, y: 112, angle: -35 })

  const pathD = PATHS[travelMode]

  useEffect(() => {
    if (!pathRef.current) return
    setPathLength(pathRef.current.getTotalLength())
  }, [pathD])

  useEffect(() => {
    if (!pathRef.current || pathLength === 0) return
    const clamped = Math.max(0, Math.min(1, progress))
    const pt    = pathRef.current.getPointAtLength(clamped * pathLength)
    const ahead = pathRef.current.getPointAtLength(Math.min((clamped + 0.012) * pathLength, pathLength))
    setPos({ x: pt.x, y: pt.y, angle: Math.atan2(ahead.y - pt.y, ahead.x - pt.x) * (180 / Math.PI) })
  }, [progress, pathLength])

  const traveledLength = pathLength * Math.max(0, Math.min(1, progress))

  const flipVehicle = travelMode === 'car' || travelMode === 'boat'
  const vehicleTransform = travelMode === 'plane'
    ? `rotate(${pos.angle}, ${pos.x}, ${pos.y})`
    : flipVehicle
      ? `matrix(-1,0,0,1,${pos.x * 2},0)`
      : undefined

  const vehicleEmoji = travelMode === 'plane' ? '✈' : travelMode === 'car' ? '🚗' : '⛵'
  const vehicleSize  = travelMode === 'plane' ? 36 : 28

  return (
    <div className="w-full px-2">
      <svg viewBox="0 0 600 165" className="w-full" style={{ overflow: 'visible' }}>

        {/* Background path */}
        <path d={pathD} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2"
          strokeDasharray="6 6" strokeLinecap="round" />

        {/* Traveled portion */}
        {pathLength > 0 && (
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5"
            strokeLinecap="round" strokeDasharray={`${traveledLength} ${pathLength}`} />
        )}

        {/* Hidden measurement path */}
        <path ref={pathRef} d={pathD} fill="none" stroke="none" />

        <Pin cx={60}  label="Home"><HomeIcon /></Pin>
        <Pin cx={540} label={destination}>{destIcon(sceneType)}</Pin>

        {/* Vehicle */}
        <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={vehicleSize} fill="white" transform={vehicleTransform}
          style={{ filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.6))', userSelect: 'none' }}>
          {vehicleEmoji}
        </text>

      </svg>
    </div>
  )
}
