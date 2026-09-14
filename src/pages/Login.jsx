import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/logo.png'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const { user, role, loading: authLoading, fetchRole } = useAuth()

  // Si ya está autenticado, redirigir a su sección según rol
  useEffect(() => {
    if (!authLoading && user) {
      if (role === 'admin') {
        navigate('/colaboradores', { replace: true })
      } else if (role === 'asistente') {
        navigate('/mi-panel', { replace: true })
      } else {
        navigate('/mi-horario', { replace: true })
      }
    }
  }, [authLoading, user, role, navigate])

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

      const loggedRole = await fetchRole(data.user)

      if (loggedRole === 'admin') {
        navigate('/colaboradores')
      } else if (loggedRole === 'asistente') {
        navigate('/mi-panel')
      } else {
        navigate('/mi-horario')
      }
    } catch (err) {
      setError(err.message)
    } finally {
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
