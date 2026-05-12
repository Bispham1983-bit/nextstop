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
  if (loading) return null
  return (
    <Routes>
      <Route path="/login"       element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/join/:token" element={<Join />} />
      <Route path="/"            element={<Protected><Home /></Protected>} />
      <Route path="/admin"       element={<Protected><Admin /></Protected>} />
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
