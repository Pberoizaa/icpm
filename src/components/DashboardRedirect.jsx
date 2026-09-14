import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

/**
 * DashboardRedirect - Redirige /dashboard al destino exacto según el rol del usuario:
 * - admin -> /colaboradores
 * - asistente -> /mi-panel
 * - profesor -> /mi-horario
 * - no autenticado -> /
 */
function DashboardRedirect() {
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

  if (role === 'admin') {
    return <Navigate to="/colaboradores" replace />
  }

  if (role === 'asistente') {
    return <Navigate to="/mi-panel" replace />
  }

  return <Navigate to="/mi-horario" replace />
}

export default DashboardRedirect
