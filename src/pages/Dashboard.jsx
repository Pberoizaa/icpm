import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../services/supabase'
import AdminDashboard from './AdminDashboard'
import TeacherDashboard from './TeacherDashboard'
import AssistantDashboard from './AssistantDashboard'
import { logActivity } from '../services/activity'

const ADMIN_ROUTES = [
  '/colaboradores',
  '/coberturas',
  '/reemplazos',
  '/horarios',
  '/permisos',
  '/registros',
  '/monitoreo'
]

function Dashboard() {
  const [role, setRole] = useState(null)
  const [sessionUser, setSessionUser] = useState(null)
  const [hasChecked, setHasChecked] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let isMounted = true

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const user = session?.user || (await supabase.auth.getUser()).data?.user

        if (!user) {
          if (isMounted) navigate('/')
          return
        }

        if (isMounted) setSessionUser(user)

        const { data: profile } = await supabase
          .from('profesores')
          .select('rol')
          .ilike('email', user.email)
          .maybeSingle()

        const userRole = profile?.rol || 'profesor'
        if (isMounted) {
          setRole(userRole)
          setHasChecked(true)
        }
      } catch (err) {
        console.error('Initial check failed:', err)
        if (isMounted) navigate('/')
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        navigate('/')
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [navigate])

  // Control de acceso y redirecciones según el cargo y la URL actual
  useEffect(() => {
    if (!hasChecked || !role) return

    const currentPath = location.pathname

    if (role === 'admin') {
      // Si el admin está en /dashboard, /mi-horario o /mi-panel, redirigir a /colaboradores
      if (currentPath === '/dashboard' || currentPath === '/mi-horario' || currentPath === '/mi-panel' || currentPath === '/') {
        navigate('/colaboradores', { replace: true })
      }
    } else if (role === 'asistente') {
      // Asistente solo puede ver /mi-panel. Si intenta entrar a rutas de admin, lo redirige.
      if (ADMIN_ROUTES.includes(currentPath) || currentPath === '/dashboard' || currentPath === '/mi-horario' || currentPath === '/') {
        navigate('/mi-panel', { replace: true })
      }
    } else {
      // Profesor solo puede ver /mi-horario. Si intenta entrar a rutas de admin, lo redirige.
      if (ADMIN_ROUTES.includes(currentPath) || currentPath === '/dashboard' || currentPath === '/mi-panel' || currentPath === '/') {
        navigate('/mi-horario', { replace: true })
      }
    }
  }, [hasChecked, role, location.pathname, navigate])

  useEffect(() => {
    // Registro de actividad (excluyendo administradores)
    if (sessionUser && role && hasChecked && role !== 'admin') {
      logActivity(sessionUser.id, 'ingreso_plataforma', { role })
    }
  }, [sessionUser?.id, role, hasChecked])

  if (!hasChecked || !sessionUser) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ opacity: 0.5 }}>Iniciando...</div>
      </div>
    )
  }

  return (
    <>
      {role === 'admin' ? (
        <AdminDashboard user={sessionUser} />
      ) : role === 'asistente' ? (
        <AssistantDashboard user={sessionUser} />
      ) : (
        <TeacherDashboard user={sessionUser} />
      )}
    </>
  )
}

export default Dashboard
