import { lazy, Suspense, useEffect, useState } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  useNavigate,
  NavLink,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { api, ApiError, type Session } from "./lib/api";
import AvisoMembresia from "./components/AvisoMembresia";
import BloqueoMembresia, { type Bloqueo } from "./components/BloqueoMembresia";
import Notificaciones from "./pages/Notificaciones";
import DirtyProvider from "./components/experiencia/DirtyProvider";
import ModalCoordinator from "./components/experiencia/ModalCoordinator";
import { useDirty } from "./lib/dirty";
const ExperienciaAdmin = lazy(() => import("./pages/ExperienciaAdmin"));
import Actividades from "./pages/Actividades";
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
import LocalesAdmin, { LocalesNegocio } from "./pages/Locales";
import SelectorLocal from "./components/SelectorLocal";
import Servicios from "./pages/Servicios";
import CobrarServicios from "./pages/CobrarServicios";
import PersonalAdmin from "./pages/PersonalAdmin";
import ControlAdmin from "./pages/ControlAdmin";
import Cajas from "./pages/Cajas";
import Rendimiento from "./pages/Rendimiento";
import Auditoria from "./pages/Auditoria";
import Preparaciones, { Mesas } from "./pages/Pedidos";
import OrdenesCompra from "./pages/OrdenesCompra";
import { useData } from "./lib/useData";
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
  ["Órdenes de compra", "/panel/ordenes-compra", "COMPRAS_GESTIONAR"],
  ["Preparaciones", "/panel/preparaciones", "PREPARACION_GESTIONAR"],
  ["Caja y cierres", "/panel/cajas", "CAJA_GESTIONAR"],
  ["Rendimiento", "/panel/rendimiento", "RENDIMIENTO_VER"],
  ["Actividades", "/panel/actividades", "ACTIVIDADES_GESTIONAR"],
  ["Auditoría", "/panel/auditoria", "ADMIN"],
  ["Facturación electrónica", "/panel/facturacion", "FACTURACION_VER"],
  ["IGV y compras", "/panel/tributacion", "IMPUESTOS_VER"],
  ["Locales", "/panel/locales", "ADMIN"],
  ["Usuarios", "/panel/usuarios", "ADMIN"],
  ["Roles", "/panel/roles", "ADMIN"],
  ["Mi plan", "/panel/plan", "ADMIN"],
  ["Notificaciones", "/panel/notificaciones", "TODOS"],
  ["Configuración", "/panel/configuracion", "ADMIN"],
] as const;
function Shell({
  session,
  onLogout,
  postLogin = false,
}: {
  postLogin?: boolean;
  session: Session;
  onLogout: () => void;
}) {
  const drafts = useDirty();
  const admin = session.rol === "ADMIN",
    superadmin = session.rol === "SUPERADMIN";
  const atencion = !superadmin && session.modalidad === "ATENCION";
  const config = useData(
    () =>
      superadmin
        ? Promise.resolve({ preparacion_habilitada: false })
        : api<{ preparacion_habilitada: boolean }>("/operacion/configuracion"),
    { preparacion_habilitada: false },
  );
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
        ["Personal y accesos", "/admin/personal"],
        ["Control operativo", "/admin/control"],
        ["Perfiles y avisos", "/admin/experiencia"],
        ["Pagos y planes", "/admin/pagos"],
        ["Catálogo común", "/admin/catalogo"],
        ["Sucursales", "/admin/locales"],
        ["Visualizaciones de usuarios", "/admin/visualizaciones"],
      ]
    : atencion
      ? [
          ["Atención y servicios", "/atencion"],
          ...(session.nichoTema === "RESTAURANTE" &&
          can(session, "MESAS_GESTIONAR")
            ? [["Mesas", "/atencion/mesas"]]
            : []),
          ...(can(session, "SERVICIOS_VER") || can(session, "PRODUCTOS_VER")
            ? [["Catálogo común", "/atencion/catalogo"]]
            : []),
          ...(can(session, "CAJA_GESTIONAR")
            ? [["Caja y cierres", "/atencion/cajas"]]
            : []),
          ...(can(session, "ACTIVIDADES_GESTIONAR")
            ? [["Actividades", "/atencion/actividades"]]
            : []),
          ...(can(session, "RENDIMIENTO_VER")
            ? [["Rendimiento", "/atencion/rendimiento"]]
            : []),
          ...(admin ? [["Auditoría", "/atencion/auditoria"]] : []),
          ...(can(session, "SERVICIOS_VER") || can(session, "VENTAS_GESTIONAR")
            ? [["Servicios", "/atencion/servicios"]]
            : []),
          ...(can(session, "VENTAS_GESTIONAR")
            ? [
                ["Cobrar servicios", "/atencion/cobrar"],
                ["Ventas", "/atencion/ventas"],
              ]
            : []),
          ["Notificaciones", "/atencion/notificaciones"],
          ...(admin
            ? [
                ["Locales", "/atencion/locales"],
                ["Personal", "/atencion/usuarios"],
                ["Roles", "/atencion/roles"],
                ["Mi plan", "/atencion/plan"],
              ]
            : []),
        ]
      : empresaLinks.filter(
          (l) =>
            (l[1] !== "/panel/preparaciones" ||
              config.data.preparacion_habilitada) &&
            (l[2] === "TODOS" ||
              (l[2] === "ADMIN" ? admin : can(session, l[2]))),
        );
  const home = links[0]?.[1] || "/sin-acceso";
  return (
    <div
      className="app-shell"
      data-nicho={atencion ? session.nichoTema || "OTRO" : "COMERCIO"}
    >
      {!superadmin && (
        <ModalCoordinator session={session} postLogin={postLogin} />
      )}
      <a href="#contenido" className="skip-link">
        Saltar al contenido
      </a>
      <aside className="sidebar">
        <NavLink to={home} className="wordmark">
          ALSHA<span>FACTURAS</span>
        </NavLink>
        <p className="sidebar-caption">
          {!superadmin && (
            <span className="niche-emoji" aria-hidden="true">
              {session.nichoEmoji || "🛒"}{" "}
            </span>
          )}
          {superadmin
            ? "Administración de plataforma"
            : atencion
              ? session.tipoNombre || "Atención y servicios"
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
          {!superadmin && <SelectorLocal session={session} />}
          <div className="account">
            <span>
              <strong>{session.nombre}</strong>
              <small>{session.rol}</small>
            </span>
            <button
              disabled={busy}
              onClick={() => drafts?.confirm(() => void logout())}
            >
              {busy ? "Cerrando…" : "Cerrar sesión"}
            </button>
          </div>
        </header>
        <main id="contenido" className="content" tabIndex={-1}>
          <ErrorNotice message={error} />
          {!superadmin && (
            <AvisoMembresia
              href={
                atencion ? "/atencion/notificaciones" : "/panel/notificaciones"
              }
            />
          )}
          <Routes>
            {!superadmin && can(session, "ACTIVIDADES_GESTIONAR") && (
              <>
                <Route path="/panel/actividades" element={<Actividades />} />
                <Route path="/atencion/actividades" element={<Actividades />} />
              </>
            )}
            {!superadmin && (
              <>
                <Route
                  path="/panel/notificaciones"
                  element={<Notificaciones />}
                />
                <Route
                  path="/atencion/notificaciones"
                  element={<Notificaciones />}
                />
              </>
            )}
            {superadmin ? (
              <>
                <Route
                  path="/admin/experiencia"
                  element={
                    <Suspense
                      fallback={
                        <p role="status">Cargando perfiles y avisos…</p>
                      }
                    >
                      <ExperienciaAdmin />
                    </Suspense>
                  }
                />
                <Route path="/admin/personal" element={<PersonalAdmin />} />
                <Route
                  path="/admin/control"
                  element={<ControlAdmin session={session} />}
                />
                <Route path="/admin/locales" element={<LocalesAdmin />} />
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
                {can(session, "MESAS_GESTIONAR") &&
                  session.nichoTema === "RESTAURANTE" && (
                    <Route path="/atencion/mesas" element={<Mesas />} />
                  )}
                {(can(session, "SERVICIOS_VER") ||
                  can(session, "PRODUCTOS_VER")) && (
                  <Route
                    path="/atencion/catalogo"
                    element={<CatalogoNegocio />}
                  />
                )}
                {can(session, "CAJA_GESTIONAR") && (
                  <Route
                    path="/atencion/cajas"
                    element={<Cajas session={session} />}
                  />
                )}
                {can(session, "RENDIMIENTO_VER") && (
                  <Route
                    path="/atencion/rendimiento"
                    element={<Rendimiento />}
                  />
                )}
                {admin && (
                  <Route path="/atencion/auditoria" element={<Auditoria />} />
                )}
                <Route
                  path="/atencion"
                  element={<Atencion session={session} />}
                />
                {(can(session, "SERVICIOS_VER") ||
                  can(session, "VENTAS_GESTIONAR")) && (
                  <Route
                    path="/atencion/servicios"
                    element={<Servicios session={session} />}
                  />
                )}
                {can(session, "VENTAS_GESTIONAR") && (
                  <>
                    <Route
                      path="/atencion/cobrar"
                      element={<CobrarServicios session={session} />}
                    />
                    <Route
                      path="/atencion/ventas"
                      element={
                        <Ventas
                          atencion
                          admin={can(session, "VENTAS_ANULAR")}
                        />
                      }
                    />
                  </>
                )}
                {admin && (
                  <>
                    <Route
                      path="/atencion/locales"
                      element={<LocalesNegocio />}
                    />
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
                {config.data.preparacion_habilitada &&
                  can(session, "PREPARACION_GESTIONAR") && (
                    <Route
                      path="/panel/preparaciones"
                      element={<Preparaciones />}
                    />
                  )}
                {can(session, "CAJA_GESTIONAR") && (
                  <Route
                    path="/panel/cajas"
                    element={<Cajas session={session} />}
                  />
                )}
                {can(session, "RENDIMIENTO_VER") && (
                  <Route path="/panel/rendimiento" element={<Rendimiento />} />
                )}
                {can(session, "COMPRAS_GESTIONAR") && (
                  <Route
                    path="/panel/ordenes-compra"
                    element={<OrdenesCompra />}
                  />
                )}
                {admin && (
                  <Route path="/panel/auditoria" element={<Auditoria />} />
                )}
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
                    <Route path="/panel/locales" element={<LocalesNegocio />} />
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
  const navigate = useNavigate();
  const [postLogin, setPostLogin] = useState(false);
  const [bloqueo, setBloqueo] = useState<Bloqueo | null>(null);
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  async function restore() {
    setLoading(true);
    setError("");
    try {
      setSession(await api<Session>("/auth/me"));
    } catch (e) {
      if (!(e instanceof ApiError && [401, 402, 403].includes(e.status)))
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
          !(e instanceof ApiError && [401, 402, 403].includes(e.status))
        )
          setError(
            "No se pudo conectar con el servidor. Comprueba que esté disponible.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    const blocked = (e: Event) => {
      setBloqueo((e as CustomEvent<Bloqueo>).detail);
      setSession(null);
      setError("");
    };
    const invalidate = () => setSession(null);
    window.addEventListener("subscription-blocked", blocked);
    window.addEventListener("session-invalid", invalidate);
    return () => {
      cancelled = true;
      window.removeEventListener("session-invalid", invalidate);
      window.removeEventListener("subscription-blocked", blocked);
    };
  }, []);
  if (loading)
    return (
      <main className="loading-page" role="status">
        Conectando con AlshaFacturas…
      </main>
    );
  if (bloqueo)
    return (
      <BloqueoMembresia
        data={bloqueo}
        onClose={() => {
          setBloqueo(null);
          setSession(null);
          navigate("/login");
        }}
      />
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
        <DirtyProvider>
          <Shell
            session={session}
            postLogin={postLogin}
            onLogout={() => setSession(null)}
          />
        </DirtyProvider>
      </SessionContext.Provider>
    );
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Login
            onLogin={(s) => {
              setPostLogin(true);
              setSession(s);
            }}
          />
        }
      />
      <Route
        path="/admin/login"
        element={
          <Login
            onLogin={(s) => {
              setPostLogin(true);
              setSession(s);
            }}
            admin
          />
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
const router = createBrowserRouter([{ path: "*", element: <SessionApp /> }]);
export default function App() {
  return <RouterProvider router={router} />;
}
