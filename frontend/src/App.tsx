import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { Home }  from './pages/Home'
import { Admin } from './pages/Admin'
import { Login } from './pages/Login'
import { Join }  from './pages/Join'

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { user, loading } = useAuth()
  return (
    <Routes>
      {/* Public routes — render immediately, no auth gate */}
      <Route path="/join/:token" element={<Join />} />
      <Route path="/login"       element={loading ? null : user ? <Navigate to="/" replace /> : <Login />} />
      {/* Protected routes — wait for auth to resolve */}
      <Route path="/"            element={<Protected><Home /></Protected>} />
      <Route path="/admin"       element={<Protected><Admin /></Protected>} />
      <Route path="*"            element={loading ? null : <Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
