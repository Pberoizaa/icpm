import React, { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { logActivity } from '../../services/activity';

function PermitManager({ onRefresh }) {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [comment, setComment] = useState('');
  const [activeView, setActiveView] = useState('pendiente');

  const fetchPermisos = async () => {
    try {
      const { data, error } = await supabase
        .from('permisos_administrativos')
        .select('*, profesores(nombre)')
        .eq('estado', activeView)
        .order('fecha', { ascending: true });

      if (error) throw error;
      setPermisos(data || []);
    } catch (err) {
      console.error('Error fetching permits:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('permisos_administrativos')
          .select('*, profesores(nombre)')
          .eq('estado', activeView)
          .order('fecha', { ascending: true });

        if (!ignore) {
          if (error) throw error;
          setPermisos(data || []);
        }
      } catch (err) {
        console.error('Error fetching permits:', err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [activeView]);

  const handleAction = async (permit, newStatus) => {
    setProcessingId(permit.id);
    try {
      const { error } = await supabase
        .from('permisos_administrativos')
        .update({ 
          estado: newStatus,
          comentario_admin: comment,
          actualizado_en: new Date().toISOString()
        })
        .eq('id', permit.id);

      if (error) throw error;
      
      // Registrar auditoría
      await logActivity(null, newStatus === 'aprobado' ? 'aprobacion_permiso' : 'rechazo_permiso', {
        modulo: 'permisos',
        accion_label: newStatus === 'aprobado' ? 'Aprobación de permiso' : 'Rechazo de permiso',
        docente: permit.profesores?.nombre,
        fecha_permiso: permit.fecha,
        tipo_dia: permit.tipo_dia,
        comentario_admin: comment || null,
        descripcion: `Se ${newStatus === 'aprobado' ? 'aprobó' : 'rechazó'} el permiso administrativo (${permit.tipo_dia?.toUpperCase()}) de ${permit.profesores?.nombre} para el día ${permit.fecha}.${comment ? ` Comentario: "${comment}"` : ''}`
      });

      alert(newStatus === 'aprobado' ? 'Permiso aprobado. Las coberturas se han generado automáticamente.' : 'Permiso rechazado.');
      setComment('');
      fetchPermisos();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al procesar: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (permit) => {
    const docenteNombre = permit.profesores?.nombre || 'el docente';
    const confirmDelete = window.confirm(
      `¿Estás seguro de que deseas eliminar este registro de día administrativo de ${docenteNombre} (${permit.fecha}, ${permit.tipo_dia?.toUpperCase()})?\n\nEsta acción no se puede deshacer y quedará registrada en el Registro de Acciones.`
    );
    if (!confirmDelete) return;

    setProcessingId(permit.id);
    try {
      // Si el permiso estaba aprobado, eliminar coberturas generadas automáticamente
      if (permit.estado === 'aprobado') {
        await supabase
          .from('coberturas')
          .delete()
          .eq('profesor_ausente_id', permit.profesor_id)
          .eq('fecha', permit.fecha)
          .eq('tipo', 'cobertura');
      }

      const { error } = await supabase
        .from('permisos_administrativos')
        .delete()
        .eq('id', permit.id);

      if (error) throw error;

      // Registrar auditoría de eliminación
      await logActivity(null, 'eliminacion_permiso', {
        modulo: 'permisos',
        accion_label: 'Eliminación de permiso administrativo',
        docente: permit.profesores?.nombre,
        fecha_permiso: permit.fecha,
        tipo_dia: permit.tipo_dia,
        motivo: permit.motivo,
        estado_previo: permit.estado,
        comentario_admin_previo: permit.comentario_admin,
        descripcion: `Se eliminó el permiso administrativo (${permit.tipo_dia?.toUpperCase()}) de ${permit.profesores?.nombre} para el día ${permit.fecha}. Motivo: ${permit.motivo || 'No especificado'}. Estado previo: ${permit.estado}.`
      });

      alert('Permiso eliminado exitosamente.');
      fetchPermisos();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Error al eliminar permiso: ' + err.message);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="permit-manager">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2>Gestión de Permisos Administrativos</h2>
          <p style={{ opacity: 0.7, fontSize: '0.9rem' }}>Aprobar o rechazar solicitudes de días administrativos.</p>
        </div>
        <div className="view-selector" style={{ background: 'var(--bg-soft)', padding: '0.4rem', borderRadius: '0.8rem', display: 'flex', gap: '0.4rem' }}>
          <button 
            className={`tab-button ${activeView === 'pendiente' ? 'active' : ''}`} 
            onClick={() => setActiveView('pendiente')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Pendientes
          </button>
          <button 
            className={`tab-button ${activeView === 'aprobado' ? 'active' : ''}`} 
            onClick={() => setActiveView('aprobado')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Aprobados
          </button>
          <button 
            className={`tab-button ${activeView === 'rechazado' ? 'active' : ''}`} 
            onClick={() => setActiveView('rechazado')}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
          >
            Rechazados
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando solicitudes...</div>
      ) : permisos.length === 0 ? (
        <div className="empty-state" style={{ background: 'white', padding: '4rem', borderRadius: '1.5rem', textAlign: 'center', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📅</span>
          <p>No hay solicitudes {activeView}s en este momento.</p>
        </div>
      ) : (
        <div className="permit-grid" style={{ display: 'grid', gap: '1.5rem' }}>
          {permisos.map(p => (
            <div key={p.id} className="stat-card" style={{ textAlign: 'left', borderLeft: `6px solid ${p.estado === 'aprobado' ? '#10b981' : p.estado === 'rechazado' ? '#ef4444' : '#f59e0b'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{p.profesores?.nombre}</h4>
                  <span style={{ fontSize: '0.9rem', color: 'var(--accent)', fontWeight: 700 }}>
                    {p.fecha} • {p.tipo_dia === 'completo' ? 'Día Completo' : p.tipo_dia.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div className={`badge badge-${p.estado === 'aprobado' ? 'success' : p.estado === 'rechazado' ? 'danger' : 'warning'}`}>
                    {p.estado.toUpperCase()}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(p)}
                    disabled={processingId === p.id}
                    title="Eliminar este permiso"
                    style={{
                      background: 'transparent',
                      border: '1px solid #fecaca',
                      color: '#dc2626',
                      borderRadius: '0.5rem',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
              
              <div style={{ background: 'var(--bg-soft)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                <strong style={{ fontSize: '0.8rem', opacity: 0.6, display: 'block', marginBottom: '0.5rem' }}>MOTIVO:</strong>
                <p style={{ margin: 0 }}>{p.motivo || 'No especificado.'}</p>
              </div>

              {activeView === 'pendiente' && (
                <div className="actions" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <textarea 
                    placeholder="Agregar comentario para el docente (opcional)..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    style={{ fontSize: '0.9rem' }}
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button 
                      className="btn-save" 
                      onClick={() => handleAction(p, 'aprobado')}
                      disabled={processingId === p.id}
                      style={{ flex: 1, backgroundColor: '#10b981' }}
                    >
                      Aprobar
                    </button>
                    <button 
                      className="btn-cancel" 
                      onClick={() => handleAction(p, 'rechazado')}
                      disabled={processingId === p.id}
                      style={{ flex: 1, backgroundColor: '#fee2e2', color: '#ef4444', borderColor: '#fecaca' }}
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              )}

              {p.comentario_admin && activeView !== 'pendiente' && (
                <div style={{ marginTop: '1rem', padding: '1rem', borderTop: '1px solid var(--border)', fontSize: '0.9rem' }}>
                  <strong>Comentario Admin:</strong> {p.comentario_admin}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default PermitManager;
