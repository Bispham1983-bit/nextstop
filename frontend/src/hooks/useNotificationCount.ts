import { useEffect, useRef, useState, useCallback } from 'react'
import { useApiFetch } from '../context/AuthContext'

export function useNotificationCount() {
  const apiFetch = useApiFetch()
  const [count, setCount] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await apiFetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setCount(data.count ?? 0)
    } catch {}
  }, [apiFetch])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, 30_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [refresh])

  return { count, refresh }
}
