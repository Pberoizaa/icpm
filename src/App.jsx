import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Login from './pages/Login'
import AdminDashboard from './pages/AdminDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AssistantDashboard from './pages/AssistantDashboard'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardRedirect from './components/DashboardRedirect'

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Acceso público */}
        <Route path="/" element={<Login />} />

        {/* Redirección inteligente de /dashboard al panel correspondiente al rol */}
        <Route path="/dashboard" element={<DashboardRedirect />} />

        {/* Pestañas exclusivas para Administrador */}
        <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
          <Route element={<AdminDashboard />}>
            <Route path="/colaboradores" element={null} />
            <Route path="/coberturas" element={null} />
            <Route path="/reemplazos" element={null} />
            <Route path="/horarios" element={null} />
            <Route path="/permisos" element={null} />
            <Route path="/registros" element={null} />
            <Route path="/monitoreo" element={null} />
          </Route>
        </Route>

        {/* Vista para Profesores */}
        <Route element={<ProtectedRoute allowedRoles={['profesor']} />}>
          <Route path="/mi-horario" element={<TeacherDashboard />} />
        </Route>

        {/* Vista para Asistentes */}
        <Route element={<ProtectedRoute allowedRoles={['asistente']} />}>
          <Route path="/mi-panel" element={<AssistantDashboard />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
