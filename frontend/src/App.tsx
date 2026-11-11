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
import { SessionContext, can } from "./lib/session";
import Roles from "./pages/Roles";
import { MiPlan, PagosAdmin } from "./pages/Planes";
import { CatalogoAdmin, CatalogoNegocio } from "./pages/CatalogoComun";
import Tributacion from "./pages/Tributacion";
import Visualizaciones from "./pages/Visualizaciones";
import Atencion from "./pages/Atencion";
const empresaLinks = [
  ["Resumen", "/panel", "RESUMEN_VER"],
  ["Punto de venta", "/panel/pos", "VENTAS_GESTIONAR"],
  ["Ventas", "/panel/ventas", "VENTAS_GESTIONAR"],
  ["Clientes", "/panel/clientes", "CLIENTES_GESTIONAR"],
  ["Productos", "/panel/productos", "PRODUCTOS_VER"],
  ["Catálogo común", "/panel/catalogo", "PRODUCTOS_VER"],
  ["Inventario", "/panel/inventario", "INVENTARIO_VER"],
  ["Registrar compra", "/panel/compra", "COMPRAS_GESTIONAR"],
  ["Compras", "/panel/compras", "COMPRAS_GESTIONAR"],
  ["Facturación electrónica", "/panel/facturacion", "FACTURACION_VER"],
  ["IGV y compras", "/panel/tributacion", "IMPUESTOS_VER"],
  ["Usuarios", "/panel/usuarios", "ADMIN"],
  ["Roles", "/panel/roles", "ADMIN"],
  ["Mi plan", "/panel/plan", "ADMIN"],
  ["Configuración", "/panel/configuracion", "ADMIN"],
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
  const atencion = !superadmin && session.modalidad === "ATENCION";
  const [mobileOpen, setMobileOpen] = useState(false);
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
    ? [
        ["Empresas", "/admin/empresas"],
        ["Pagos y planes", "/admin/pagos"],
        ["Catálogo común", "/admin/catalogo"],
        ["Visualizaciones de usuarios", "/admin/visualizaciones"],
      ]
    : atencion
      ? [
          ["Atención y servicios", "/atencion"],
          ...(admin
            ? [
                ["Personal", "/atencion/usuarios"],
                ["Roles", "/atencion/roles"],
                ["Mi plan", "/atencion/plan"],
              ]
            : []),
        ]
      : empresaLinks.filter((l) =>
          l[2] === "ADMIN" ? admin : can(session, l[2]),
        );
  const home = links[0]?.[1] || "/sin-acceso";
  return (
    <div className="app-shell">
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <NavLink to={home} className="wordmark">
          ALSHA<span>FACTURAS</span>
        </NavLink>
        <p className="sidebar-caption">
          {superadmin
            ? "Administración de plataforma"
            : atencion
              ? "Atención y servicios"
              : "Gestión empresarial"}
        </p>
        <button
          className="mobile-menu"
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="main-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? "Cerrar menú" : "Menú"}
        </button>
        <nav
          id="main-navigation"
          data-open={mobileOpen}
          aria-label="Navegación principal"
        >
          {links.map(([label, path]) => (
            <NavLink
              key={path}
              to={path}
              end
              onClick={() => {
                setMobileOpen(false);
                document.getElementById("contenido")?.focus();
              }}
            >
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
                <Route path="/admin/pagos" element={<PagosAdmin />} />
                <Route path="/admin/catalogo" element={<CatalogoAdmin />} />
                <Route
                  path="/admin/visualizaciones"
                  element={<Visualizaciones />}
                />
              </>
            ) : atencion ? (
              <>
                <Route
                  path="/atencion"
                  element={<Atencion session={session} />}
                />
                {admin && (
                  <>
                    <Route
                      path="/atencion/usuarios"
                      element={<Usuarios session={session} />}
                    />
                    <Route path="/atencion/roles" element={<Roles />} />
                    <Route path="/atencion/plan" element={<MiPlan />} />
                  </>
                )}
              </>
            ) : (
              <>
                {can(session, "RESUMEN_VER") && (
                  <Route path="/panel" element={<Dashboard />} />
                )}
                {can(session, "VENTAS_GESTIONAR") && (
                  <>
                    <Route path="/panel/pos" element={<Operacion />} />
                    <Route
                      path="/panel/ventas"
                      element={<Ventas admin={can(session, "VENTAS_ANULAR")} />}
                    />
                  </>
                )}
                {can(session, "CLIENTES_GESTIONAR") && (
                  <Route path="/panel/clientes" element={<Clientes />} />
                )}
                {can(session, "PRODUCTOS_VER") && (
                  <>
                    <Route path="/panel/productos" element={<Productos />} />
                    <Route
                      path="/panel/catalogo"
                      element={<CatalogoNegocio />}
                    />
                  </>
                )}
                {can(session, "INVENTARIO_VER") && (
                  <Route path="/panel/inventario" element={<Inventario />} />
                )}
                {can(session, "COMPRAS_GESTIONAR") && (
                  <>
                    <Route
                      path="/panel/compra"
                      element={<Operacion key="compra" compra />}
                    />
                    <Route path="/panel/compras" element={<Compras />} />
                  </>
                )}
                {can(session, "FACTURACION_VER") && (
                  <Route
                    path="/panel/facturacion"
                    element={
                      <Sunat admin={can(session, "FACTURACION_EMITIR")} />
                    }
                  />
                )}
                {can(session, "IMPUESTOS_VER") && (
                  <Route path="/panel/tributacion" element={<Tributacion />} />
                )}
                {admin && (
                  <>
                    <Route
                      path="/panel/usuarios"
                      element={<Usuarios session={session} />}
                    />
                    <Route path="/panel/roles" element={<Roles />} />
                    <Route path="/panel/plan" element={<MiPlan />} />
                    <Route
                      path="/panel/configuracion"
                      element={<Configuracion />}
                    />
                  </>
                )}
              </>
            )}
            <Route
              path="/sin-acceso"
              element={
                <p>
                  Tu rol no tiene módulos habilitados. Consulta al
                  administrador.
                </p>
              }
            />
            <Route path="*" element={<Navigate to={home} replace />} />
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
    return (
      <SessionContext.Provider value={session}>
        <Shell session={session} onLogout={() => setSession(null)} />
      </SessionContext.Provider>
    );
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
