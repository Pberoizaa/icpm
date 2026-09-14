import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../services/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchRole = async (currentUser) => {
    if (!currentUser?.email) {
      setRole(null)
      return null
    }
    try {
      const { data: profile } = await supabase
        .from('profesores')
        .select('rol')
        .ilike('email', currentUser.email)
        .maybeSingle()

      const userRole = profile?.rol || 'profesor'
      setRole(userRole)
      return userRole
    } catch (err) {
      console.error('Error fetching role:', err)
      setRole('profesor')
      return 'profesor'
    }
  }

  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession()
        if (!mounted) return

        if (currentSession?.user) {
          setSession(currentSession)
          setUser(currentSession.user)
          await fetchRole(currentSession.user)
        } else {
          setSession(null)
          setUser(null)
          setRole(null)
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return

      if (event === 'SIGNED_OUT' || !newSession) {
        setSession(null)
        setUser(null)
        setRole(null)
        setLoading(false)
      } else if (newSession?.user) {
        setSession(newSession)
        setUser(newSession.user)
        await fetchRole(newSession.user)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = () => supabase.auth.signOut()

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signOut, fetchRole }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
