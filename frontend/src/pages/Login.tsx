import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode]       = useState<'login' | 'register'>('login')
  const [name, setName]       = useState('')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password, name)
      }
      navigate('/')
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  const inputClass = "w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-colors"
  const labelClass = "block text-blue-300/80 text-xs font-semibold tracking-wider uppercase mb-2"

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f2e] via-[#0d2a5e] to-[#1a5276] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <p className="text-white/40 text-xs tracking-[0.35em] uppercase mb-2">✈&nbsp;&nbsp;Next Stop</p>
          <h1 className="text-white text-3xl font-black">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-white/40 text-sm mt-2">
            {mode === 'login' ? 'Sign in to see your trips' : 'Start planning your adventures'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20 space-y-4">

          {mode === 'register' && (
            <div>
              <label className={labelClass}>Your name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                className={inputClass} placeholder="Sam" autoFocus />
            </div>
          )}

          <div>
            <label className={labelClass}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className={inputClass} placeholder="you@example.com"
              autoFocus={mode === 'login'} autoComplete="email" required />
          </div>

          <div>
            <label className={labelClass}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className={inputClass} placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors">
            {loading ? '...' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-white/40 text-sm mt-6">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors">
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>

      </div>
    </div>
  )
}
