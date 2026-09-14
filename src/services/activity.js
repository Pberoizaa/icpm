import { supabase } from './supabase'

/**
 * Logs a user activity event to the database.
 * @param {string|null} profesorId - The UUID of the teacher or admin. If omitted, uses current auth user.
 * @param {string} accion - Simple description or code of the action (e.g. 'permiso_eliminado', 'ingreso_plataforma').
 * @param {object} detalles - Extra metadata, including 'modulo', 'descripcion', and any contextual details.
 */
export const logActivity = async (profesorId, accion, detalles = {}) => {
  try {
    let resolvedUserId = profesorId
    if (!resolvedUserId) {
      const { data: authData } = await supabase.auth.getUser()
      resolvedUserId = authData?.user?.id
    }

    if (!resolvedUserId) {
      console.warn('logActivity: No user identified for action:', accion)
      return
    }

    const { error } = await supabase
      .from('actividad_usuarios')
      .insert([
        { 
          profesor_id: resolvedUserId, 
          accion, 
          detalles: {
            ...detalles,
            modulo: detalles.modulo || 'general',
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server',
            timestamp: new Date().toISOString()
          }
        }
      ])

    if (error) {
      console.warn('Activity log failed:', error.message)
    }
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}

