import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../services/supabase';
import * as XLSX from 'xlsx';

function ActionLogManager({ profesores = [] }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Categoría activa (Sub-pestañas estilo Lirmi)
  const [activeCategory, setActiveCategory] = useState('todas');
  
  // Filtros de barra superior
  const [filterAction, setFilterAction] = useState('todas');
  const [filterUser, setFilterUser] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('actividad_usuarios')
        .select('*, profesores:profesor_id(nombre, rol, rut)')
        .order('fecha', { ascending: false })
        .limit(500);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error('Error fetching activity logs:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function initLogs() {
      try {
        const { data, error } = await supabase
          .from('actividad_usuarios')
          .select('*, profesores:profesor_id(nombre, rol, rut)')
          .order('fecha', { ascending: false })
          .limit(500);

        if (!ignore) {
          if (error) throw error;
          setLogs(data || []);
        }
      } catch (err) {
        console.error('Error fetching activity logs:', err.message);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    initLogs();

    // Suscripción en tiempo real para reflejar nuevas acciones al instante
    const channel = supabase
      .channel('realtime_audit_logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad_usuarios' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      ignore = true;
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper para normalizar el módulo/categoría
  const getLogCategory = (log) => {
    const mod = log.detalles?.modulo;
    if (mod) return mod.toLowerCase();
    if (log.accion?.startsWith('permiso') || log.accion?.includes('permiso')) return 'permisos';
    if (log.accion?.includes('cobertura') || log.accion?.includes('reemplazo')) return 'coberturas';
    if (log.accion?.includes('profesor') || log.accion?.includes('colaborador')) return 'colaboradores';
    if (log.accion?.includes('horario')) return 'horarios';
    if (log.accion === 'ingreso_plataforma') return 'accesos';
    return 'otros';
  };

  // Helper para el nombre amigable de la acción
  const getActionName = (log) => {
    if (log.detalles?.accion_label) return log.detalles.accion_label;
    
    switch (log.accion) {
      case 'ingreso_plataforma':
        return 'Inicio de sesión';
      case 'eliminacion_permiso':
        return 'Eliminación de permiso administrativo';
      case 'aprobacion_permiso':
        return 'Aprobación de permiso administrativo';
      case 'rechazo_permiso':
        return 'Rechazo de permiso administrativo';
      case 'solicitud_permiso':
        return 'Solicitud de día administrativo';
      case 'creacion_cobertura':
        return 'Asignación de cobertura';
      case 'cancelacion_cobertura':
        return 'Cancelación de cobertura';
      default:
        return log.accion ? log.accion.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Acción del sistema';
    }
  };

  // Helper para nombre legible del módulo
  const getModuleName = (log) => {
    const cat = getLogCategory(log);
    switch (cat) {
      case 'permisos': return 'Permisos Administrativos';
      case 'coberturas': return 'Coberturas';
      case 'colaboradores': return 'Colaboradores';
      case 'horarios': return 'Horarios';
      case 'accesos': return 'Accesos y Sesión';
      default: return 'Sistema';
    }
  };

  // Helper para formatear fecha y hora
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper para obtener el texto detallado
  const getDetailsText = (log) => {
    if (log.detalles?.descripcion) {
      return log.detalles.descripcion;
    }
    if (log.accion === 'ingreso_plataforma') {
      const isMobile = log.detalles?.userAgent?.includes('Mobi');
      const device = isMobile ? 'Dispositivo Móvil' : 'Escritorio / Navegador';
      const roleStr = log.detalles?.role ? ` como ${log.detalles.role}` : '';
      return `Inicio de sesión exitoso${roleStr} desde ${device}.`;
    }
    if (log.detalles && Object.keys(log.detalles).length > 0) {
      const filtered = { ...log.detalles };
      delete filtered.userAgent;
      delete filtered.timestamp;
      delete filtered.modulo;
      delete filtered.accion_label;
      if (Object.keys(filtered).length > 0) {
        return JSON.stringify(filtered);
      }
    }
    return 'Sin detalles adicionales.';
  };

  // Opciones únicas de acciones para el selector de filtro
  const availableActions = useMemo(() => {
    const actionSet = new Set();
    logs.forEach(log => {
      actionSet.add(getActionName(log));
    });
    return Array.from(actionSet);
  }, [logs]);

  // Filtrado de logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Filtro por sub-pestaña de categoría
      if (activeCategory !== 'todas') {
        const cat = getLogCategory(log);
        if (cat !== activeCategory) return false;
      }

      // Filtro por acción
      if (filterAction !== 'todas') {
        if (getActionName(log) !== filterAction) return false;
      }

      // Filtro por usuario
      if (filterUser !== 'todos') {
        if (log.profesor_id !== filterUser) return false;
      }

      // Filtro por fecha (Desde / Hasta)
      if (startDate) {
        const logDate = new Date(log.fecha).toISOString().split('T')[0];
        if (logDate < startDate) return false;
      }
      if (endDate) {
        const logDate = new Date(log.fecha).toISOString().split('T')[0];
        if (logDate > endDate) return false;
      }

      return true;
    });
  }, [logs, activeCategory, filterAction, filterUser, startDate, endDate]);

  // Descarga en formato Excel (.xlsx)
  const handleDownloadExcel = () => {
    if (filteredLogs.length === 0) {
      alert('No hay registros para descargar con los filtros seleccionados.');
      return;
    }

    const dataToExport = filteredLogs.map(log => ({
      'Acción Realizada': getActionName(log),
      'Módulo': getModuleName(log),
      'Usuario': log.profesores?.nombre || 'Usuario Desconocido',
      'Fecha y Hora': formatDateTime(log.fecha),
      'Detalles': getDetailsText(log)
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    // Ancho automático de columnas
    ws['!cols'] = [
      { wch: 32 },
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 70 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registro de Acciones');

    const todayStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `registro_acciones_icpm_${todayStr}.xlsx`);
  };

  const categories = [
    { id: 'todas', label: 'Todas' },
    { id: 'permisos', label: 'Permisos' },
    { id: 'coberturas', label: 'Coberturas' },
    { id: 'colaboradores', label: 'Colaboradores' },
    { id: 'horarios', label: 'Horarios' },
    { id: 'accesos', label: 'Accesos' }
  ];

  return (
    <div className="action-log-manager" style={{ textAlign: 'left', animation: 'fadeIn 0.2s ease-in-out' }}>
      {/* Encabezado estilo Lirmi */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.65rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 0.4rem 0' }}>
          Registro de acciones
        </h2>
        <p style={{ color: 'var(--text-muted, #64748b)', fontSize: '0.92rem', margin: 0, lineHeight: '1.45' }}>
          En este sector podrás revisar las modificaciones realizadas en la plataforma, ya sean cambios realizados por los usuarios o por el sistema. Podrás filtrar por acción, módulo o rango de fechas.
        </p>
      </div>

      {/* Sub-pestañas horizontales estilo Lirmi */}
      <div style={{ 
        display: 'flex', 
        gap: '2rem', 
        borderBottom: '1px solid #e2e8f0', 
        marginBottom: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '0.2rem'
      }}>
        {categories.map(cat => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '0.5rem 0.2rem 0.75rem 0.2rem',
                fontSize: '0.95rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#f43f5e' : '#64748b',
                borderBottom: isActive ? '2.5px solid #f43f5e' : '2.5px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros estilo Lirmi */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr)) auto', 
        gap: '1rem', 
        alignItems: 'flex-end',
        background: '#ffffff',
        padding: '1.25rem',
        borderRadius: '0.75rem',
        border: '1px solid #e2e8f0',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
      }}>
        {/* Filtro Acción */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Acción
          </label>
          <select 
            value={filterAction} 
            onChange={e => setFilterAction(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.55rem 0.75rem', 
              borderRadius: '0.5rem', 
              border: '1px solid #cbd5e1', 
              fontSize: '0.85rem',
              background: '#f8fafc',
              color: '#1e293b'
            }}
          >
            <option value="todas">Todas</option>
            {availableActions.map(action => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>
        </div>

        {/* Filtro Usuario */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Usuario
          </label>
          <select 
            value={filterUser} 
            onChange={e => setFilterUser(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.55rem 0.75rem', 
              borderRadius: '0.5rem', 
              border: '1px solid #cbd5e1', 
              fontSize: '0.85rem',
              background: '#f8fafc',
              color: '#1e293b'
            }}
          >
            <option value="todos">Todos</option>
            {profesores.map(p => (
              <option key={p.id} value={p.id}>
                {p.nombre} {p.rol === 'admin' ? '(Admin)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por fecha (Desde) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Desde
          </label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.55rem 0.75rem', 
              borderRadius: '0.5rem', 
              border: '1px solid #cbd5e1', 
              fontSize: '0.85rem',
              background: '#f8fafc',
              color: '#1e293b'
            }}
          />
        </div>

        {/* Filtro por fecha (Hasta) */}
        <div>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
            Hasta
          </label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.55rem 0.75rem', 
              borderRadius: '0.5rem', 
              border: '1px solid #cbd5e1', 
              fontSize: '0.85rem',
              background: '#f8fafc',
              color: '#1e293b'
            }}
          />
        </div>

        {/* Botón Descargar estilo Lirmi */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(startDate || endDate || filterAction !== 'todas' || filterUser !== 'todos') && (
            <button
              type="button"
              onClick={() => {
                setFilterAction('todas');
                setFilterUser('todos');
                setStartDate('');
                setEndDate('');
              }}
              title="Limpiar filtros"
              style={{
                padding: '0.55rem 0.75rem',
                borderRadius: '0.5rem',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Limpiar
            </button>
          )}

          <button
            type="button"
            onClick={handleDownloadExcel}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              padding: '0.55rem 1.15rem',
              borderRadius: '0.5rem',
              border: '1px solid #fda4af',
              background: '#ffffff',
              color: '#e11d48',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(225, 29, 72, 0.05)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#fff1f2';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#ffffff';
            }}
          >
            <span style={{ fontSize: '1rem' }}>📥</span>
            Descargar
          </button>
        </div>
      </div>

      {/* Tabla de registros estilo Lirmi */}
      <div style={{ 
        background: '#ffffff', 
        borderRadius: '0.75rem', 
        border: '1px solid #e2e8f0', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        {loading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <p>Cargando registros de auditoría...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>📋</span>
            <p style={{ margin: 0, fontWeight: 500, fontSize: '1rem' }}>No se encontraron acciones registradas con los filtros seleccionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 600 }}>
                  <th style={{ padding: '0.9rem 1.1rem', minWidth: '170px' }}>Acción realizada</th>
                  <th style={{ padding: '0.9rem 1.1rem', minWidth: '130px' }}>Módulo</th>
                  <th style={{ padding: '0.9rem 1.1rem', minWidth: '180px' }}>Usuario</th>
                  <th style={{ padding: '0.9rem 1.1rem', minWidth: '140px', whiteSpace: 'nowrap' }}>Fecha y hora</th>
                  <th style={{ padding: '0.9rem 1.1rem', minWidth: '280px' }}>Detalles</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log, index) => {
                  const actionName = getActionName(log);
                  const isDelete = log.accion?.includes('elimina') || log.accion?.includes('cancel');
                  const isApprove = log.accion?.includes('aproba') || log.accion?.includes('completa');
                  const isReject = log.accion?.includes('rechaz');

                  return (
                    <tr 
                      key={log.id || index}
                      style={{ 
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.1s'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#fafafa'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      {/* Acción Realizada */}
                      <td style={{ padding: '0.9rem 1.1rem', fontWeight: 500, color: '#1e293b' }}>
                        <span style={{
                          display: 'inline-block',
                          padding: '0.2rem 0.55rem',
                          borderRadius: '0.375rem',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          backgroundColor: isDelete ? '#fee2e2' : isApprove ? '#dcfce7' : isReject ? '#fef3c7' : '#f1f5f9',
                          color: isDelete ? '#b91c1c' : isApprove ? '#15803d' : isReject ? '#b45309' : '#334155'
                        }}>
                          {actionName}
                        </span>
                      </td>

                      {/* Módulo */}
                      <td style={{ padding: '0.9rem 1.1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        {getModuleName(log)}
                      </td>

                      {/* Usuario */}
                      <td style={{ padding: '0.9rem 1.1rem', color: '#0f172a', fontWeight: 600 }}>
                        {log.profesores?.nombre ? log.profesores.nombre.toUpperCase() : 'USUARIO DEL SISTEMA'}
                      </td>

                      {/* Fecha y Hora */}
                      <td style={{ padding: '0.9rem 1.1rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                        {formatDateTime(log.fecha)}
                      </td>

                      {/* Detalles */}
                      <td style={{ padding: '0.9rem 1.1rem', color: '#334155', lineHeight: '1.45' }}>
                        {getDetailsText(log)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer con resumen de cantidad */}
        <div style={{ 
          padding: '0.8rem 1.25rem', 
          borderTop: '1px solid #e2e8f0', 
          background: '#f8fafc',
          color: '#64748b', 
          fontSize: '0.82rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Total de registros mostrados: <strong>{filteredLogs.length}</strong></span>
          <span>Actualizado en tiempo real</span>
        </div>
      </div>
    </div>
  );
}

export default ActionLogManager;
