import { useEffect, useRef, useState } from 'react'

interface FlightPathProps {
  progress: number
}

interface PlanePos {
  x: number
  y: number
  angle: number
}

const PATH_D = 'M 60,130 Q 300,15 540,130'

export function FlightPath({ progress }: FlightPathProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const [planePos, setPlanePos] = useState<PlanePos>({ x: 60, y: 130, angle: -25 })

  useEffect(() => {
    if (!pathRef.current) return
    setPathLength(pathRef.current.getTotalLength())
  }, [])

  useEffect(() => {
    if (!pathRef.current || pathLength === 0) return
    const clamped = Math.max(0, Math.min(1, progress))
    const pt = pathRef.current.getPointAtLength(clamped * pathLength)
    const aheadPt = pathRef.current.getPointAtLength(Math.min((clamped + 0.015) * pathLength, pathLength))
    const angle = Math.atan2(aheadPt.y - pt.y, aheadPt.x - pt.x) * (180 / Math.PI)
    setPlanePos({ x: pt.x, y: pt.y, angle })
  }, [progress, pathLength])

  const traveledLength = pathLength * Math.max(0, Math.min(1, progress))

  return (
    <div className="w-full px-2">
      <svg viewBox="0 0 600 175" className="w-full" style={{ overflow: 'visible' }}>

        {/* Background dashed arc */}
        <path
          d={PATH_D}
          fill="none"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="2.5"
          strokeDasharray="8 7"
          strokeLinecap="round"
        />

        {/* Traveled portion — solid glowing line */}
        {pathLength > 0 && (
          <path
            d={PATH_D}
            fill="none"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${traveledLength} ${pathLength}`}
            style={{ filter: 'drop-shadow(0 0 4px #60a5fa)' }}
          />
        )}

        {/* Hidden reference path for measuring */}
        <path ref={pathRef} d={PATH_D} fill="none" stroke="none" />

        {/* UK flag + label */}
        <text x="60" y="152" textAnchor="middle" fontSize="26">🇬🇧</text>
        <text x="60" y="172" textAnchor="middle" fontSize="10" fill="rgba(147,197,253,0.7)" fontFamily="Inter, sans-serif" fontWeight="500">UK</text>

        {/* Mexico flag + label */}
        <text x="540" y="152" textAnchor="middle" fontSize="26">🇲🇽</text>
        <text x="540" y="172" textAnchor="middle" fontSize="10" fill="rgba(147,197,253,0.7)" fontFamily="Inter, sans-serif" fontWeight="500">Mexico</text>

        {/* Plane */}
        <text
          x={planePos.x}
          y={planePos.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="26"
          fill="white"
          transform={`rotate(${planePos.angle}, ${planePos.x}, ${planePos.y})`}
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.8))', userSelect: 'none' }}
        >
          ✈
        </text>

      </svg>
    </div>
  )
}
