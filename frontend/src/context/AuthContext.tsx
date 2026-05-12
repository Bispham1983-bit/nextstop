import { createContext, useContext, useEffect, useState } from 'react'

interface User { id: number; email: string; name: string }

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login:    (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout:   () => void
}

const AuthContext = createContext<AuthContextType>(null!)

const TOKEN_KEY = 'nextstop_token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]     = useState<User | null>(null)
  const [token, setToken]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount
  useEffect(() => {
    const saved = localStorage.getItem(TOKEN_KEY)
    if (!saved) { setLoading(false); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${saved}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => { if (u) { setToken(saved); setUser(u) } else { localStorage.removeItem(TOKEN_KEY) } })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    const res  = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Login failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
  }

  const register = async (email: string, password: string, name: string) => {
    const res  = await fetch('/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Registration failed')
    localStorage.setItem(TOKEN_KEY, data.token)
    setToken(data.token)
    setUser(data.user)
  }

  const logout = () => {
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

// Helper — fetch with auth token attached
export function useApiFetch() {
  const { token } = useAuth()
  return (url: string, options: RequestInit = {}) =>
    fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    })
}
