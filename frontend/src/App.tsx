
import { useState } from "react"
import Sidebar from "./components/Sidebar"
import Header from "./components/Header"
import Dashboard from "./pagos/Dashboard"

function App() {
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

export default App
