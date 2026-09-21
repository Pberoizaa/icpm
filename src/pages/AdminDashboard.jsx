import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import logo from '../assets/logo.png';
import { formatLongDate, getWeekRange } from '../services/dateUtils';
import { EfemerideWidget } from '../components/shared/EfemerideWidget';
import UiScaleWidget from '../components/shared/UiScaleWidget';

// Modular Components
import ProfessorManager from '../components/admin/ProfessorManager';
import CoveragePlanner from '../components/admin/CoveragePlanner';
import LongTermReplacements from '../components/admin/LongTermReplacements';
import ScheduleEditor from '../components/admin/ScheduleEditor';
import ActivityMonitor from '../components/admin/ActivityMonitor';
import WeeklyHistory from '../components/admin/WeeklyHistory';
import CoverageSummary from '../components/admin/CoverageSummary';
import PermitManager from '../components/admin/PermitManager';
import RecentCoveragesTable from '../components/admin/RecentCoveragesTable';
import ActionLogManager from '../components/admin/ActionLogManager';

// Map URL pathnames to internal tab keys
const ROUTE_TO_TAB = {
  '/colaboradores': 'profesores',
  '/coberturas': 'coberturas',
  '/reemplazos': 'reemplazos',
  '/horarios': 'horarios',
  '/permisos': 'permisos',
  '/registros': 'registros',
  '/monitoreo': 'monitoreo',
};

function AdminDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive active tab from current URL, fallback to 'profesores'
  const activeTab = ROUTE_TO_TAB[location.pathname] ?? 'profesores';

  // Redirect /dashboard to /colaboradores
  useEffect(() => {
    if (location.pathname === '/dashboard') {
      navigate('/colaboradores', { replace: true });
    }
  }, [location.pathname, navigate]);

  const [profesores, setProfesores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [asignaturas, setAsignaturas] = useState([]);
  const [reemplazos, setReemplazos] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [plannedCoverages, setPlannedCoverages] = useState([]);
  const [activeCoverageDates, setActiveCoverageDates] = useState([]);
  const [allSchedules, setAllSchedules] = useState([]);
  const [todaySummary, setTodaySummary] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [weeklyHistory, setWeeklyHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pendingPermits, setPendingPermits] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationRef = useRef(null);

  // Password Change State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passData, setPassData] = useState({ newPass: '', confirmPass: '' });

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      await fetchAllData();
      setLoading(false);
    };
    initialize();
  }, []);

  useEffect(() => {
    // Real-time Subscriptions
    const channel = supabase
      .channel('admin_dashboard_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coberturas' }, () => fetchCoverageData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profesores' }, () => fetchProfesores())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reemplazos_periodos' }, () => fetchReemplazos())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'permisos_administrativos' }, () => fetchPendingPermits())
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchProfesores(),
      fetchAsignaturas(),
      fetchReemplazos(),
      fetchCoverageData(),
      fetchActivityLogs(),
      fetchAllSchedules(),
      fetchWeeklyHistory(),
      fetchPendingPermits()
    ]);
    setLoading(false);
  };

  const fetchPendingPermits = async () => {
    try {
      const { data } = await supabase
        .from('permisos_administrativos')
        .select('id, fecha, valor_dia, motivo, profesores(nombre)')
        .eq('estado', 'pendiente')
        .order('fecha', { ascending: true });
      setPendingPermits(data || []);
    } catch (err) {
      console.error('Error fetching pending permits:', err);
    }
  };

  const fetchProfesores = async () => {
    const { data } = await supabase.from('profesores').select('*').order('nombre');
    setProfesores(data || []);
  };

  const fetchAsignaturas = async () => {
    const { data } = await supabase.from('asignaturas').select('*').order('nombre');
    setAsignaturas(data || []);
  };

  const fetchReemplazos = async () => {
    const { data } = await supabase.from('reemplazos_periodos').select('*, ausente:profesores!profesor_ausente_id(nombre), reemplazo:profesores!profesor_reemplazante_id(nombre)').order('fecha_inicio', { ascending: false });
    setReemplazos(data || []);
  };

  const fetchCoverageData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const [{ data: coverages }, { data: dates }, { data: todayCov }] = await Promise.all([
      supabase.from('coberturas').select('*, ausente:profesores!profesor_ausente_id(nombre), reemplazo:profesores!profesor_reemplazante_id(nombre), horarios(*)').eq('tipo', 'cobertura').order('fecha', { ascending: false }).limit(500),
      supabase.from('coberturas').select('fecha').eq('tipo', 'cobertura').neq('estado', 'cancelada'),
      supabase.from('coberturas').select('ausente:profesores!profesor_ausente_id(nombre), reemplazo:profesores!profesor_reemplazante_id(nombre)').eq('fecha', today).eq('tipo', 'cobertura').neq('estado', 'cancelada')
    ]);
    setPlannedCoverages(coverages || []);
    setActiveCoverageDates(Array.from(new Set((dates || []).map(d => d.fecha))));
    
    // Format unique today summary
    const summaryMap = new Map();
    (todayCov || []).forEach(c => {
      if (c.ausente && c.reemplazo) {
        summaryMap.set(c.ausente.nombre, c.reemplazo.nombre);
      }
    });
    setTodaySummary(Array.from(summaryMap.entries()).map(([ausente, reemplazo]) => `${ausente} (por ${reemplazo})`));
  };

  const fetchActivityLogs = async () => {
    const { data } = await supabase
      .from('actividad_usuarios')
      .select('*, profes:profesores(nombre, rol)')
      .order('fecha', { ascending: false })
      .limit(300);
    
    // Filter out administrators from the list
    const filtered = (data || []).filter(log => log.profes?.rol !== 'admin');
    setActivityLogs(filtered.slice(0, 200));
  };

  const fetchAllSchedules = async () => {
    const { data } = await supabase.from('horarios').select('*, asignaturas(nombre)');
    setAllSchedules(data || []);
  };

  const fetchWeeklyHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('historial_uso_semanal')
        .select('*, profesores(nombre)')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setWeeklyHistory(data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleManualWeeklyReset = async () => {
    const { start, end } = getWeekRange(new Date().toISOString().split('T')[0]);
    
    if (!confirm(`¿Estás seguro de cerrar la semana del ${start} al ${end}? Esto guardará un resumen y reiniciará los contadores de horas para todos los profesores.`)) return;

    setProcessing(true);
    try {
      const { data, error } = await supabase.rpc('cerrar_semana_laboral', {
        p_semana_inicio: start,
        p_semana_fin: end
      });

      if (error) throw error;

      alert(`Semana cerrada exitosamente. Se procesaron registros de asistencia.`);
      await fetchAllData();
    } catch (err) {
      alert("Error al cerrar semana: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateOwnPassword = async (e) => {
    e.preventDefault();
    if (passData.newPass !== passData.confirmPass) return alert("Las contraseñas no coinciden");
    if (passData.newPass.length < 6) return alert("Mínimo 6 caracteres");

    setProcessing(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passData.newPass });
      if (error) throw error;
      alert("Contraseña actualizada con éxito");
      setIsPasswordModalOpen(false);
      setPassData({ newPass: '', confirmPass: '' });
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleDismissPendingCoverages = async () => {
    const pendingCovIds = plannedCoverages.filter(c => c.estado === 'pendiente').map(c => c.id);
    if (pendingCovIds.length === 0) return;
    
    if (!window.confirm('¿Estás seguro de descartar/cancelar todas las coberturas diarias pendientes?')) return;
    
    try {
      const { error } = await supabase
        .from('coberturas')
        .update({ estado: 'cancelada' })
        .in('id', pendingCovIds);
        
      if (error) throw error;
      await fetchCoverageData();
      setIsNotificationsOpen(false);
    } catch (err) {
      alert('Error al descartar coberturas: ' + err.message);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="dashboard-header">
        <div className="header-info">
          <img 
            src={logo} 
            alt="IC Logo" 
            className="logo-header" 
            onClick={() => navigate('/colaboradores')}
            style={{ cursor: 'pointer' }}
          />
          <div className="header-text">
            <h1>Panel de Administración</h1>
            <p className="header-subtitle">Instituto Comercial Puerto Montt</p>
            <div className="header-date">{formatLongDate(new Date())}</div>
            <EfemerideWidget />
          </div>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <UiScaleWidget />
          {/* Botón Inicio / Dashboard (Casita) */}
          <button
            type="button"
            className="headbar-icon-btn"
            onClick={() => navigate('/colaboradores')}
            title="Inicio / Dashboard"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </button>

          {/* Campana de Notificaciones con Dropdown */}
          <div className="notification-bell-container" ref={notificationRef}>
            <button
              type="button"
              className="headbar-icon-btn"
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              title="Notificaciones"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {(pendingPermits.length + plannedCoverages.filter(c => c.estado === 'pendiente').length) > 0 && (
                <span className="notification-badge">
                  {pendingPermits.length + plannedCoverages.filter(c => c.estado === 'pendiente').length}
                </span>
              )}
            </button>

            {isNotificationsOpen && (
              <div className="notifications-dropdown">
                <div className="notifications-header">
                  <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Notificaciones</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {(pendingPermits.length + plannedCoverages.filter(c => c.estado === 'pendiente').length) > 0 && (
                      <span style={{ fontSize: '0.75rem', background: '#6d28d9', color: 'white', padding: '0.15rem 0.5rem', borderRadius: '1rem', fontWeight: 700 }}>
                        {pendingPermits.length + plannedCoverages.filter(c => c.estado === 'pendiente').length} pendientes
                      </span>
                    )}
                    {plannedCoverages.filter(c => c.estado === 'pendiente').length > 0 && (
                      <button 
                        onClick={handleDismissPendingCoverages}
                        style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', border: '1px solid var(--border)', background: '#f8fafc', cursor: 'pointer' }}
                        title="Descartar todas las coberturas pendientes"
                      >
                        Limpiar Coberturas
                      </button>
                    )}
                  </div>
                </div>
                <div className="notifications-list" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                  {pendingPermits.length === 0 && plannedCoverages.filter(c => c.estado === 'pendiente').length === 0 ? (
                    <div className="empty-notifications" style={{ padding: '1.5rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                      No tienes notificaciones pendientes 🎉
                    </div>
                  ) : (
                    <>
                      {pendingPermits.map(p => (
                        <div
                          key={`permit-${p.id}`}
                          className="notification-item"
                          style={{ cursor: 'pointer', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'left' }}
                          onClick={() => { setIsNotificationsOpen(false); navigate('/permisos'); }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#6d28d9', marginBottom: '0.2rem' }}>
                            📝 Solicitud de Día Administrativo
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                            {p.profesores?.nombre || 'Docente'} solicita {p.valor_dia} día para el {p.fecha}
                          </div>
                          {p.motivo && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>
                              "{p.motivo}"
                            </div>
                          )}
                        </div>
                      ))}

                      {plannedCoverages.filter(c => c.estado === 'pendiente').map(c => (
                        <div
                          key={`cov-${c.id}`}
                          className="notification-item"
                          style={{ cursor: 'pointer', padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', textAlign: 'left' }}
                          onClick={() => { setIsNotificationsOpen(false); navigate('/coberturas'); }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.2rem' }}>
                            📋 Cobertura Pendiente
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#334155' }}>
                            Reemplazo de {c.ausente?.nombre || 'Docente'} ({c.fecha})
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <button className="logout-button" onClick={() => setIsPasswordModalOpen(true)}>Cambiar Contraseña</button>
          <button className="logout-button" onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button>
        </div>
      </header>

      <div className="admin-layout-body">
        <aside className="lirmi-sidebar">
          <div className="sidebar-nav-group">
            <span className="sidebar-group-title">Módulos de Gestión</span>
            <nav className="sidebar-menu">
              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'profesores' ? 'active' : ''}`}
                onClick={() => navigate('/colaboradores')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </span>
                <span className="sidebar-label">Colaboradores</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'coberturas' ? 'active' : ''}`}
                onClick={() => navigate('/coberturas')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </span>
                <span className="sidebar-label">Coberturas</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'reemplazos' ? 'active' : ''}`}
                onClick={() => navigate('/reemplazos')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </span>
                <span className="sidebar-label">Reemplazos</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'horarios' ? 'active' : ''}`}
                onClick={() => navigate('/horarios')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <span className="sidebar-label">Horarios</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'permisos' ? 'active' : ''}`}
                onClick={() => navigate('/permisos')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </span>
                <span className="sidebar-label">Días Administrativos</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'registros' ? 'active' : ''}`}
                onClick={() => navigate('/registros')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </span>
                <span className="sidebar-label">Registro de Acciones</span>
              </button>

              <button
                type="button"
                className={`sidebar-nav-item ${activeTab === 'monitoreo' ? 'active' : ''}`}
                onClick={() => navigate('/monitoreo')}
              >
                <span className="sidebar-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </span>
                <span className="sidebar-label">Monitoreo</span>
              </button>
            </nav>
          </div>
        </aside>

        <main className="admin-main-content">
          <div className="tab-content">
          {activeTab === 'profesores' && (
            <ProfessorManager 
              supabase={supabase} 
              profesores={profesores} 
              loading={loading} 
              todaySummary={todaySummary}
              onRefresh={fetchProfesores} 
            />
          )}
          {activeTab === 'coberturas' && (
            <CoveragePlanner 
              supabase={supabase} 
              profesores={profesores.filter(p => p.rol === 'profesor' || p.rol === 'admin')} 
              allSchedules={allSchedules}
              plannedCoverages={plannedCoverages}
              activeCoverageDates={activeCoverageDates}
              onRefresh={fetchCoverageData}
            />
          )}
          {activeTab === 'reemplazos' && (
            <LongTermReplacements 
              supabase={supabase} 
              profesores={profesores.filter(p => p.rol === 'profesor' || p.rol === 'admin')} 
              reemplazos={reemplazos} 
              onRefresh={fetchReemplazos} 
            />
          )}
          {activeTab === 'horarios' && (
            <ScheduleEditor 
              supabase={supabase} 
              profesores={profesores.filter(p => p.rol === 'profesor' || p.rol === 'admin')} 
              asignaturas={asignaturas} 
            />
          )}
          {activeTab === 'permisos' && (
            <PermitManager 
              profesores={profesores}
              onRefresh={fetchCoverageData}
            />
          )}
          {activeTab === 'registros' && (
            <ActionLogManager 
              profesores={profesores}
            />
          )}
          {activeTab === 'monitoreo' && (
            <>
              <CoverageSummary
                coverages={plannedCoverages}
                profesores={profesores}
                loading={loading}
              />

              <RecentCoveragesTable
                coverages={plannedCoverages}
                loading={loading}
              />

              <div className="admin-actions-section" style={{ marginBottom: '2rem', padding: '1rem', borderBottom: '2px dashed var(--border)' }}>
                <h3>Cierre de Ciclo Semanal</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-soft)', marginBottom: '1rem' }}>
                  Al finalizar la semana, presiona este botón para guardar el resumen de horas usadas por cada profesor 
                  y reiniciar los contadores a 0 para la próxima semana.
                </p>
                <button 
                  className="btn-save" 
                  onClick={handleManualWeeklyReset}
                  disabled={processing}
                  style={{ backgroundColor: 'var(--accent)', color: 'white' }}
                >
                  {processing ? 'Procesando...' : 'Finalizar y Archivar Semana Actual'}
                </button>

                <WeeklyHistory history={weeklyHistory} loading={historyLoading} />
              </div>

              <ActivityMonitor 
                activityLogs={activityLogs} 
                loading={loading} 
              />
            </>
          )}
        </div>
      </main>
    </div>

      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cambiar mi Contraseña</h3>
              <button className="btn-close" onClick={() => setIsPasswordModalOpen(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleUpdateOwnPassword}>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input type="password" required value={passData.newPass} onChange={e => setPassData({...passData, newPass: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input type="password" required value={passData.confirmPass} onChange={e => setPassData({...passData, confirmPass: e.target.value})} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-save" disabled={processing}>{processing ? 'Actualizando...' : 'Actualizar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
