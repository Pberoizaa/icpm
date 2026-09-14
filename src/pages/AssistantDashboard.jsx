import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import logo from '../assets/logo.png';
import { formatLongDate, getWeekRange } from '../services/dateUtils';
import { BLOQUES, DIAS } from '../services/constants';

import ScheduleViewer from './AssistantScheduleViewer';
import PermitModal from '../components/shared/PermitModal';
import { EfemerideWidget } from '../components/shared/EfemerideWidget';
import { useAuth } from '../contexts/AuthContext';

function AssistantDashboard({ user: initialUser }) {
  const { user: authUser } = useAuth();
  const effectiveUser = initialUser || authUser;
  const [user, setUser] = useState(effectiveUser);
  const [profile, setProfile] = useState(null);
  const [coberturas, setCoberturas] = useState([]);
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isPermitModalOpen, setIsPermitModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordProcessing, setPasswordProcessing] = useState(false);

  useEffect(() => {
    if (effectiveUser) {
      setUser(effectiveUser);
      fetchUserData(effectiveUser);
    }
  }, [effectiveUser]);

  async function fetchUserData(currentUser) {
    const targetUser = currentUser || user;
    if (!targetUser) return;
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profesores')
        .select('*')
        .ilike('email', targetUser.email)
        .maybeSingle();
      if (profErr) throw profErr;
      setProfile(prof);

      const { data: covData, error: covErr } = await supabase
        .from('coberturas')
        .select('*, ausente:profesores!profesor_ausente_id(nombre), reemplazo:profesores!profesor_reemplazante_id(nombre), horarios(*, asignaturas(nombre))')
        .eq('tipo', 'cobertura')
        .neq('estado', 'cancelada')
        .order('fecha', { ascending: false })
        .limit(100);
      if (covErr) throw covErr;
      setCoberturas(covData || []);

      const { data: permData, error: permErr } = await supabase
        .from('permisos_administrativos')
        .select('*')
        .eq('profesor_id', prof.id)
        .order('fecha', { ascending: false });
      if (permErr) throw permErr;
      setPermisos(permData || []);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Las contraseñas no coinciden.');
      return;
    }
    if (newPassword.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setPasswordProcessing(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      const { error: pError } = await supabase
        .from('profesores')
        .update({ cambio_clave_pendiente: false })
        .eq('id', profile.id);
      if (pError) throw pError;
      alert('Contraseña actualizada con éxito.');
      setIsPasswordModalOpen(false);
      setNewPassword('');
      setConfirmPassword('');
      fetchUserData();
    } catch (error) {
      alert('Error al cambiar contraseña: ' + error.message);
    } finally {
      setPasswordProcessing(false);
    }
  };

  const pendingCoverages = coberturas.filter(c => c.estado === 'pendiente');

  return (
    <div className="teacher-dashboard">
      <header className="dashboard-header">
        <div className="header-info">
          <img src={logo} alt="IC Logo" className="logo-header" />
          <div className="header-text">
            <h1>{profile?.nombre || 'Mi Perfil Asistente'}</h1>
            <p className="header-subtitle">Asistente de la Educación</p>
            <div className="header-date">{formatLongDate(new Date())}</div>
            <EfemerideWidget />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          {profile?.cambio_clave_pendiente && (
            <button className="btn-edit" onClick={() => setIsPasswordModalOpen(true)}>Cambiar Clave</button>
          )}
          <button className="logout-button" onClick={() => supabase.auth.signOut()}>Cerrar Sesión</button>
        </div>
      </header>

      <main>
        {profile?.cambio_clave_pendiente && (
          <div className="warning-banner" style={{ background: '#fffbeb', color: '#92400e', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', border: '1px solid #fef3c7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>⚠️ Se recomienda cambiar tu contraseña predefinida por seguridad.</span>
            <button className="btn-edit" onClick={() => setIsPasswordModalOpen(true)} style={{ marginLeft: '1rem' }}>Cambiar Ahora</button>
          </div>
        )}

        <section className="teacher-stats" style={{ gridTemplateColumns: '1fr 1fr', maxWidth: '600px', marginBottom: '2rem' }}>
          <div className="stat-card" style={{ border: '2px solid var(--accent)', cursor: 'pointer', transition: 'transform 0.15s' }} onClick={() => setIsPermitModalOpen(true)}>
            <h3>Días Administrativos</h3>
            <p style={{ fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 800 }}>
              {permisos.filter(p => new Date(p.fecha).getFullYear() === new Date().getFullYear() && p.estado === 'aprobado').reduce((sum, p) => sum + parseFloat(p.valor_dia), 0)} / 6
            </p>
            <small style={{ color: 'var(--accent)', fontWeight: 600 }}>Solicitar / Ver detalle →</small>
          </div>
          <div className="stat-card">
            <h3>Coberturas Globales (Activas)</h3>
            <p style={{ fontSize: '1.5rem', color: 'var(--accent)', fontWeight: 800 }}>{coberturas.filter(c => c.estado === 'pendiente' || c.estado === 'aprobado').length}</p>
          </div>
        </section>

        {coberturas.filter(c => c.estado === 'pendiente' || c.estado === 'aprobado').length > 0 && (
          <section className="upcoming-coverages" style={{ marginBottom: '2.5rem' }}>
            <div className="section-header">
              <h2 style={{ marginBottom: '0.5rem' }}>Coberturas Asignadas</h2>
              <p style={{ opacity: 0.7 }}>Vista general de todos los reemplazos asignados por administración.</p>
            </div>
            <div className="coverage-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {coberturas.filter(c => c.estado === 'pendiente' || c.estado === 'aprobado').slice(0, 20).map(c => (
                <div key={c.id} className="stat-card" style={{ textAlign: 'left', borderLeft: '4px solid var(--accent)', padding: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: '0.9rem', background: 'var(--bg-soft)', padding: '0.2rem 0.5rem', borderRadius: '0.4rem' }}>
                      Bloque {BLOQUES.find(b => b.inicio.slice(0, 5) === c.horarios?.hora_inicio?.slice(0, 5))?.id || '?'}°
                    </span>
                    <span style={{ fontSize: '0.8rem', opacity: 0.7, fontWeight: 500 }}>{c.fecha}</span>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.05rem' }}>{c.reemplazo?.nombre || 'Alguien'} reemplaza a {c.ausente?.nombre}</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text)' }}>
                      <span>📚 {c.horarios?.asignaturas?.nombre || 'Administrativo'}</span>
                      <span style={{ background: 'var(--bg-soft)', padding: '0.1rem 0.4rem', borderRadius: '0.3rem', fontSize: '0.75rem' }}>{c.horarios?.curso}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <ScheduleViewer supabase={supabase} profile={profile} />

      </main>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Cambiar mi Contraseña</h3>
              <button className="btn-close" onClick={() => setIsPasswordModalOpen(false)}>Cerrar</button>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Nueva Contraseña</label>
                <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Confirmar Contraseña</label>
                <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-save" disabled={passwordProcessing}>{passwordProcessing ? 'Actualizando...' : 'Actualizar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permits Modal */}
      {isPermitModalOpen && (
        <PermitModal 
          supabase={supabase} 
          profile={profile} 
          permisos={permisos} 
          onClose={() => setIsPermitModalOpen(false)}
          onRefresh={() => fetchUserData()}
        />
      )}

    </div>
  );
}

export default AssistantDashboard;
