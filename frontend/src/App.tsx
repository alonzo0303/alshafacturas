
import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import Dashboard from "./pagos/Dashboard"
import Ventas from "./pagos/Ventas"
import Login from "./auth/Login"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import AdminLogin from "./auth/AdminLogin"
import SuperAdminDashboard from "./admin/SuperAdminDashboard"
import Empresas from "./admin/Empresas"
import Usuarios from "./usuarios/Usuarios"
function PanelEmpresa() {
    return <Login />
  const [activePage, setActivePage] = useState("Dashboard")

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header />

        {activePage === "Dashboard" ? (
  <Dashboard />
) : activePage === "Ventas" ? (
  <Ventas />
) : (
          <main className="flex-1 p-8">
            <h1 className="text-3xl font-bold text-slate-800">
              {activePage}
            </h1>

            <p className="mt-2 text-slate-600">
              Módulo de {activePage.toLowerCase()} en desarrollo.
            </p>

            <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-slate-500">
                Próximamente implementaremos las funcionalidades
                de este módulo.
              </p>
            </div>
          </main>
        )}
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/demo" element={<SuperAdminDashboard />} />
        <Route
  path="/admin/demo/empresas"
  element={<Empresas />}
/>
        <Route path="/panel" element={<PanelEmpresa />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
        <Route
  path="/empresa/demo/usuarios"
  element={<Usuarios />}
/>
      </Routes>
    </BrowserRouter>
  )
}

export default App
