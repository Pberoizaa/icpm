import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NotFound from './pages/NotFound'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />

      {/* Layout persistente de Dashboard: maneja autenticación, roles y pestañas */}
      <Route element={<Dashboard />}>
        <Route path="/dashboard" element={null} />

        {/* Pestañas exclusivas para Administradores */}
        <Route path="/colaboradores" element={null} />
        <Route path="/coberturas" element={null} />
        <Route path="/reemplazos" element={null} />
        <Route path="/horarios" element={null} />
        <Route path="/permisos" element={null} />
        <Route path="/registros" element={null} />
        <Route path="/monitoreo" element={null} />

        {/* Vistas de otros cargos */}
        <Route path="/mi-horario" element={null} />
        <Route path="/mi-panel" element={null} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
