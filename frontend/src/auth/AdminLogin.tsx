
import { useState, type FormEvent } from "react"

function AdminLogin() {
  const [correo, setCorreo] = useState("")
  const [contrasena, setContrasena] = useState("")

  function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    alert(
      "Acceso administrativo en desarrollo. " +
      "La autenticación segura se implementará en el backend."
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">

        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-100 text-2xl">
            🔐
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            ALSHAFACTURAS
          </h1>

          <p className="mt-1 text-sm font-semibold text-blue-700">
            Administración de plataforma
          </p>

          <p className="mt-4 text-sm text-slate-500">
            Acceso exclusivo para el superadministrador
          </p>
        </div>

        <form onSubmit={iniciarSesion} className="space-y-5">
          <div>
            <label
              htmlFor="admin-correo"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Correo electrónico
            </label>

            <input
              id="admin-correo"
              type="email"
              required
              autoComplete="username"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              placeholder="Correo del administrador"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="admin-contrasena"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>

            <input
              id="admin-contrasena"
              type="password"
              required
              autoComplete="current-password"
              value={contrasena}
              onChange={(evento) => setContrasena(evento.target.value)}
              placeholder="Ingresa tu contraseña"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-700 py-3 font-semibold text-white hover:bg-blue-800"
          >
            Acceder al panel administrativo
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          ALSHAFACTURAS SaaS PRO · Acceso restringido
        </p>
      </div>
    </main>
  )
}

export default AdminLogin
