import { useState, useEffect } from 'react'
import { supabase } from '../services/supabase'
import logo from '../assets/logo.png'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Si ya tiene sesión activa previa, redirigir directo a su módulo
  useEffect(() => {
    let mounted = true
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email && mounted) {
          const { data: profile } = await supabase
            .from('profesores')
            .select('rol')
            .ilike('email', session.user.email)
            .maybeSingle()

          if (!mounted) return
          const rol = profile?.rol || 'profesor'
          if (rol === 'admin') {
            window.location.href = '/colaboradores'
          } else if (rol === 'asistente') {
            window.location.href = '/mi-panel'
          } else {
            window.location.href = '/mi-horario'
          }
        }
      } catch (err) {
        console.error('Session check error:', err)
      }
    }
    checkSession()
    return () => { mounted = false }
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    let finalEmail = email.trim()
    if (finalEmail && !finalEmail.includes('@')) {
      finalEmail = `${finalEmail}@icomercialpmt.cl`
    }

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password,
      })
      if (authError) throw authError

      // Obtener rol del colaborador para dirigirlo a la URL correspondiente
      const { data: profile } = await supabase
        .from('profesores')
        .select('rol')
        .ilike('email', finalEmail)
        .maybeSingle()

      const rol = profile?.rol || 'profesor'

      if (rol === 'admin') {
        window.location.href = '/colaboradores'
      } else if (rol === 'asistente') {
        window.location.href = '/mi-panel'
      } else {
        window.location.href = '/mi-horario'
      }
    } catch (err) {
      console.error('Login error:', err)
      setError(err.message || 'Credenciales inválidas')
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <img src={logo} alt="Logo Instituto Comercial" className="login-logo" />
      <h1>Iniciar Sesión</h1>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label htmlFor="email">Usuario o Email</label>
          <div className="input-with-hint">
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nombre.apellido"
              required
            />
            {!email.includes('@') && email && (
              <span className="domain-hint">@icomercialpmt.cl</span>
            )}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
        </button>
        {error && <p className="error-message">{error}</p>}
      </form>
    </div>
  )
}

export default Login
