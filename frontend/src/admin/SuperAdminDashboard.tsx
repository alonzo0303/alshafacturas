import { Link } from "react-router-dom"
function SuperAdminDashboard() {
  const modulos = [
    {
      nombre: "Empresas",
      descripcion: "Registrar, consultar y administrar empresas.",
      icono: "🏢",
    },
    {
      nombre: "Usuarios y permisos",
      descripcion: "Gestionar administradores, roles y accesos.",
      icono: "👥",
    },
    {
      nombre: "Suscripciones",
      descripcion: "Controlar planes, pagos y vencimientos.",
      icono: "💳",
    },
    {
      nombre: "Soporte empresarial",
      descripcion: "Atender solicitudes de las empresas.",
      icono: "🛠️",
    },
  ]

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-slate-950 px-6 py-5 text-white">
        <h1 className="text-2xl font-bold">
          ALSHAFACTURAS SaaS PRO
        </h1>
        <p className="mt-1 text-sm text-slate-300">
          Panel del superadministrador
        </p>
      </header>

      <div className="mx-auto max-w-6xl p-6">
        <h2 className="text-2xl font-bold text-slate-800">
          Administración general
        </h2>

        <p className="mt-2 text-slate-500">
          Gestiona las empresas que utilizan tu plataforma.
        </p>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          {modulos.map((modulo) => (
            <article
              key={modulo.nombre}
              className="rounded-xl bg-white p-6 shadow-sm"
            >
              <div className="mb-4 text-3xl">
                {modulo.icono}
              </div>

              <h3 className="text-lg font-semibold text-slate-800">
                {modulo.nombre}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {modulo.descripcion}
              </p>

              
{modulo.nombre === "Empresas" ? (
  <Link
    to="/admin/demo/empresas"
    className="mt-5 inline-block rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
  >
    Administrar empresas →
  </Link>
) : (
  <span className="mt-5 inline-block text-sm font-medium text-slate-400">
    Módulo en desarrollo
  </span>
)}

            </article>
          ))}
        </section>
      </div>
    </main>
  )
}

export default SuperAdminDashboard
