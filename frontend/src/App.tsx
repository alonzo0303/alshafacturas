import { useEffect, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { api, ApiError, type Session } from "./lib/api";
import Login from "./auth/Login";
import Sunat from "./pages/Sunat";
import Dashboard, { Configuracion } from "./pages/Dashboard";
import { Productos, Clientes } from "./pages/Catalogos";
import Inventario from "./pages/Inventario";
import Operacion from "./pages/Operacion";
import { Ventas, Compras } from "./pages/Historial";
import { Empresas, Usuarios } from "./pages/Administracion";
import { ErrorNotice } from "./components/ui";
const empresaLinks = [
  ["Resumen", "/panel", true],
  ["Punto de venta", "/panel/pos", false],
  ["Ventas", "/panel/ventas", false],
  ["Clientes", "/panel/clientes", false],
  ["Productos", "/panel/productos", true],
  ["Inventario", "/panel/inventario", true],
  ["Registrar compra", "/panel/compra", true],
  ["Compras", "/panel/compras", true],
  ["Facturación electrónica", "/panel/facturacion", false],
  ["Usuarios", "/panel/usuarios", true],
  ["Configuración", "/panel/configuracion", true],
] as const;
function Shell({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const admin = session.rol === "ADMIN",
    superadmin = session.rol === "SUPERADMIN";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function logout() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      onLogout();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const links = superadmin
    ? [["Empresas", "/admin/empresas"]]
    : empresaLinks.filter((l) => admin || !l[2]);
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <NavLink
          to={superadmin ? "/admin/empresas" : "/panel"}
          className="wordmark"
        >
          ALSHA<span>FACTURAS</span>
        </NavLink>
        <p className="sidebar-caption">
          {superadmin ? "Administración de plataforma" : "Gestión empresarial"}
        </p>
        <nav aria-label="Navegación principal">
          {links.map(([label, path]) => (
            <NavLink key={path} to={path} end>
              {label}
            </NavLink>
          ))}
        </nav>
        <p className="sidebar-footer">Alsha Group</p>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <p>{superadmin ? "Plataforma" : `Empresa #${session.empresaId}`}</p>
          <div className="account">
            <span>
              <strong>{session.nombre}</strong>
              <small>{session.rol}</small>
            </span>
            <button disabled={busy} onClick={() => void logout()}>
              {busy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <main id="contenido" className="content" tabIndex={-1}>
          <ErrorNotice message={error} />
          <Routes>
            {superadmin ? (
              <>
                <Route path="/admin/empresas" element={<Empresas />} />
                <Route
                  path="*"
                  element={<Navigate to="/admin/empresas" replace />}
                />
              </>
            ) : (
              <>
                <Route
                  path="/panel"
                  element={
                    admin ? <Dashboard /> : <Navigate to="/panel/pos" replace />
                  }
                />
                <Route path="/panel/pos" element={<Operacion />} />
                <Route
                  path="/panel/ventas"
                  element={<Ventas admin={admin} />}
                />
                <Route path="/panel/clientes" element={<Clientes />} />
                <Route
                  path="/panel/facturacion"
                  element={<Sunat admin={admin} />}
                />
                {admin && (
                  <>
                    <Route path="/panel/productos" element={<Productos />} />
                    <Route path="/panel/inventario" element={<Inventario />} />
                    <Route
                      path="/panel/compra"
                      element={<Operacion key="compra" compra />}
                    />
                    <Route path="/panel/compras" element={<Compras />} />
                    <Route
                      path="/panel/usuarios"
                      element={<Usuarios session={session} />}
                    />
                    <Route
                      path="/panel/configuracion"
                      element={<Configuracion />}
                    />
                  </>
                )}
                <Route
                  path="*"
                  element={
                    <Navigate to={admin ? "/panel" : "/panel/pos"} replace />
                  }
                />
              </>
            )}
          </Routes>
        </main>
        <footer className="workspace-footer">
          AlshaFacturas · Importes en soles (PEN)
        </footer>
      </div>
    </div>
  );
}
function SessionApp() {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function restore() {
    setLoading(true);
    setError("");
    try {
      setSession(await api<Session>("/auth/me"));
    } catch (e) {
      if (!(e instanceof ApiError && [401, 403].includes(e.status)))
        setError(
          "No se pudo conectar con el servidor. Comprueba que esté disponible.",
        );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let cancelled = false;
    api<Session>("/auth/me")
      .then((value) => {
        if (!cancelled) setSession(value);
      })
      .catch((e) => {
        if (
          !cancelled &&
          !(e instanceof ApiError && [401, 403].includes(e.status))
        )
          setError(
            "No se pudo conectar con el servidor. Comprueba que esté disponible.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const invalidate = () => setSession(null);
    window.addEventListener("session-invalid", invalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("session-invalid", invalidate);
    };
  }, []);
  if (loading)
    return (
      <main className="loading-page" role="status">
        Conectando con AlshaFacturas…
      </main>
    );
  if (error)
    return (
      <main className="loading-page">
        <ErrorNotice message={error} />
        <button onClick={() => void restore()}>Reintentar conexión</button>
      </main>
    );
  if (session)
    return <Shell session={session} onLogout={() => setSession(null)} />;
  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={setSession} />} />
      <Route
        path="/admin/login"
        element={<Login onLogin={setSession} admin />}
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
export default function App() {
  return (
    <BrowserRouter>
      <SessionApp />
    </BrowserRouter>
  );
}
