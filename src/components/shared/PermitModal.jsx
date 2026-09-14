import React, { useState } from 'react';
import { logActivity } from '../../services/activity';

const PermitModal = ({ supabase, profile, permisos, onClose, onRefresh }) => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [formData, setFormData] = useState({
    fecha: '',
    tipo_dia: 'completo',
    motivo: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const getStatusBadge = (estado) => {
    switch (estado) {
      case 'aprobado': return <span className="badge badge-success" style={{ background: '#22c55e', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem' }}>Aprobado</span>;
      case 'rechazado': return <span className="badge badge-danger" style={{ background: '#ef4444', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem' }}>Rechazado</span>;
      default: return <span className="badge badge-warning" style={{ background: '#f59e0b', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem' }}>Pendiente</span>;
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!formData.fecha || !formData.motivo) {
      alert("Por favor completa la fecha y el motivo.");
      return;
    }
    
    setSubmitting(true);
    try {
      const valor = formData.tipo_dia === 'completo' ? 1.0 : 0.5;
      const { error } = await supabase.from('permisos_administrativos').insert([{
        profesor_id: profile.id,
        fecha: formData.fecha,
        tipo_dia: formData.tipo_dia,
        valor_dia: valor,
        motivo: formData.motivo,
        estado: 'pendiente'
      }]);
      
      if (error) throw error;
      
      // Registrar en log de auditoría
      await logActivity(profile.id, 'solicitud_permiso', {
        modulo: 'permisos',
        accion_label: 'Solicitud de día administrativo',
        docente: profile.nombre,
        fecha_permiso: formData.fecha,
        tipo_dia: formData.tipo_dia,
        motivo: formData.motivo,
        descripcion: `${profile.nombre} solicitó día administrativo (${formData.tipo_dia.toUpperCase()}) para el ${formData.fecha}. Motivo: ${formData.motivo}`
      });

      alert("Solicitud enviada exitosamente.");
      setIsRequesting(false);
      setFormData({ fecha: '', tipo_dia: 'completo', motivo: '' });
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Error al enviar solicitud: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>📅 Mis Días Administrativos</h3>
          <button className="btn-close" type="button" onClick={onClose}>Cerrar</button>
        </div>

        {isRequesting ? (
          <form onSubmit={handleRequestSubmit} style={{ margin: '1rem 0' }}>
            <div className="form-group">
              <label>Fecha Solicitada</label>
              <input type="date" required value={formData.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Jornada</label>
              <select value={formData.tipo_dia} onChange={e => setFormData({...formData, tipo_dia: e.target.value})}>
                <option value="completo">Día Completo (1 día)</option>
                <option value="am">Media Jornada AM (0.5 días)</option>
                <option value="pm">Media Jornada PM (0.5 días)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Motivo</label>
              <textarea 
                required 
                placeholder="Breve descripción del motivo..."
                value={formData.motivo} 
                onChange={e => setFormData({...formData, motivo: e.target.value})} 
                style={{ width: '100%', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)', minHeight: '80px' }}
              />
            </div>
            <div className="modal-actions" style={{ marginTop: '1rem' }}>
              <button type="button" className="btn-cancel" onClick={() => setIsRequesting(false)}>Cancelar</button>
              <button type="submit" className="btn-save" disabled={submitting}>
                {submitting ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', margin: '1.25rem 0' }}>
              {[
                { label: 'Aprobados', estado: 'aprobado', color: '#22c55e' },
                { label: 'Rechazados', estado: 'rechazado', color: '#ef4444' },
                { label: 'Pendientes', estado: 'pendiente', color: '#f59e0b' },
              ].map(({ label, estado, color }) => {
                const dias = permisos
                  .filter(p => new Date(p.fecha).getFullYear() === new Date().getFullYear() && p.estado === estado)
                  .reduce((sum, p) => sum + parseFloat(p.valor_dia), 0);
                return (
                  <div key={estado} style={{
                    background: 'var(--bg-soft)',
                    borderRadius: '0.75rem',
                    padding: '1rem',
                    textAlign: 'center',
                    borderTop: `3px solid ${color}`
                  }}>
                    <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.6, margin: '0 0 0.25rem 0' }}>{label}</p>
                    <p style={{ fontSize: '1.75rem', fontWeight: 900, color, margin: 0 }}>{dias}</p>
                    <small style={{ opacity: 0.5 }}>días</small>
                  </div>
                )
              })}
            </div>

            {/* Total bar & Request Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-soft)',
              borderRadius: '0.75rem',
              padding: '0.75rem 1.25rem',
              marginBottom: '1.25rem',
              fontSize: '0.95rem'
            }}>
              <div>
                <span style={{ opacity: 0.7, display: 'block', fontSize: '0.8rem' }}>Total aprobados este año</span>
                <strong style={{ fontSize: '1.1rem' }}>
                  {permisos.filter(p => new Date(p.fecha).getFullYear() === new Date().getFullYear() && p.estado === 'aprobado').reduce((sum, p) => sum + parseFloat(p.valor_dia), 0)} / 6 días
                </strong>
              </div>
              <button 
                className="btn-save" 
                style={{ background: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '0.5rem', color: 'white', border: 'none', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => setIsRequesting(true)}
              >
                + Solicitar Día
              </button>
            </div>

            {/* Record list */}
            {permisos.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5 }}>
                <p style={{ marginBottom: '0.5rem' }}>Sin solicitudes aún</p>
                <small>Usa el botón de arriba para solicitar un día libre.</small>
              </div>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                {permisos.map(p => (
                  <div key={p.id} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border)',
                    gap: '0.75rem',
                    flexWrap: 'wrap'
                  }}>
                    <div>
                      <p style={{ fontWeight: 600, margin: '0 0 0.2rem 0', fontSize: '0.95rem' }}>
                        {new Date(p.fecha + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long' })}
                      </p>
                      <small style={{ opacity: 0.6 }}>
                        {p.tipo_dia === 'completo' ? 'Día Completo' : p.tipo_dia === 'am' ? 'Media Jornada AM' : 'Media Jornada PM'}
                        {p.motivo && ` • ${p.motivo}`}
                      </small>
                      {p.comentario_admin && <div style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '0.2rem' }}>↳ Admin: {p.comentario_admin}</div>}
                    </div>
                    {getStatusBadge(p.estado)}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
              <button className="btn-cancel" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PermitModal;
