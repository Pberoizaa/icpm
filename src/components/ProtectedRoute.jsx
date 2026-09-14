import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * ProtectedRoute: protege rutas por sesión y rol del usuario.
 * Usa Outlet para actuar como Layout Route y no desmontar componentes innecesariamente.
 *
 * @param {string[]} allowedRoles - Lista de roles autorizados (ej: ['admin']).
 */
function ProtectedRoute({ allowedRoles = [] }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ opacity: 0.5 }}>Iniciando...</div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    if (role === 'admin') return <Navigate to="/colaboradores" replace />
    if (role === 'asistente') return <Navigate to="/mi-panel" replace />
    return <Navigate to="/mi-horario" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
