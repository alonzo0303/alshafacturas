
import { useState, type FormEvent } from "react"


type Trabajador = {
  id: number
  nombre: string
  correo: string
  rol: string
  estado: "Activo" | "Inactivo"
}

function Usuarios() {
  const [nombre, setNombre] = useState("")
  const [correo, setCorreo] = useState("")
  const [rol, setRol] = useState("Vendedor")
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])

  function registrarTrabajador(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault()

    if (!nombre.trim() || !correo.trim()) {
      alert("Completa los datos del trabajador.")
      return
    }

    if (
      trabajadores.some(
        (trabajador) =>
          trabajador.correo === correo.trim().toLowerCase()
      )
    ) {
      alert("Ya existe un trabajador con ese correo.")
      return
    }

  
const nuevoTrabajador: Trabajador = {
  id: Date.now(),
  nombre: nombre.trim(),
  correo: correo.trim().toLowerCase(),
  rol,
  estado: "Activo",
}


    setTrabajadores((anteriores) => [
      ...anteriores,
      nuevoTrabajador,
    ])

    setNombre("")
    setCorreo("")
    setRol("Vendedor")
  }

function cambiarEstadoTrabajador(id: number) {
  const trabajador = trabajadores.find(
    (item) => item.id === id
  )

  if (!trabajador) return

  const accion =
    trabajador.estado === "Activo" ? "desactivar" : "reactivar"

  const confirmado = window.confirm(
    `¿Deseas ${accion} a ${trabajador.nombre}?`
  )

  if (!confirmado) return

  setTrabajadores((anteriores) =>
    anteriores.map((item) =>
      item.id === id
        ? {
            ...item,
            estado:
              item.estado === "Activo" ? "Inactivo" : "Activo",
          }
        : item
    )
  )
}

  return (
    <main className="min-h-screen bg-slate-100 p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold text-slate-900">
          Usuarios y permisos
        </h1>

        <p className="mt-2 text-slate-500">
          Administra los trabajadores y sus accesos.
        </p>

        <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">
            Registrar trabajador
          </h2>

          <form
            onSubmit={registrarTrabajador}
            className="mt-6 space-y-4"
          >
            <div>
              <label
                htmlFor="nombre"
                className="mb-2 block text-sm font-medium"
              >
                Nombre completo
              </label>

              <input
                id="nombre"
                type="text"
                required
                value={nombre}
                onChange={(evento) =>
                  setNombre(evento.target.value)
                }
                placeholder="Nombre del trabajador"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="correo"
                className="mb-2 block text-sm font-medium"
              >
                Correo electrónico
              </label>

              <input
                id="correo"
                type="email"
                required
                value={correo}
                onChange={(evento) =>
                  setCorreo(evento.target.value)
                }
                placeholder="trabajador@empresa.com"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="rol"
                className="mb-2 block text-sm font-medium"
              >
                Rol del trabajador
              </label>

              <select
                id="rol"
                value={rol}
                onChange={(evento) =>
                  setRol(evento.target.value)
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              >
                <option value="Administrador">Administrador</option>
                <option value="Jefe de almacén">Jefe de almacén</option>
                <option value="Vendedor">Vendedor</option>
                <option value="Cajero">Cajero</option>
              </select>
            </div>

            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
            >
              Registrar trabajador
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-800">
            Personal registrado
          </h2>

          {trabajadores.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">
              Todavía no hay trabajadores registrados.
            </p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="p-3">Nombre</th>
                    <th className="p-3">Correo</th>
                    <th className="p-3">Rol</th>
                    <th className="p-3">Estado</th>
                    <th className="p-3">Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {trabajadores.map((trabajador) => (
                    <tr
                      key={trabajador.id}
                      className="border-b"
                    >
                      <td className="p-3">
                        {trabajador.nombre}
                      </td>
                      <td className="p-3">
                        {trabajador.correo}
                      </td>
                      <td className="p-3">
                        {trabajador.rol}
                      </td>
                      
<td className="p-3">
  <span
    className={`rounded-full px-3 py-1 text-xs font-medium ${
      trabajador.estado === "Activo"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700"
    }`}
  >
    {trabajador.estado}
  </span>
</td>

<td className="p-3">
  <button
    type="button"
    onClick={() => cambiarEstadoTrabajador(trabajador.id)}
    className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
      trabajador.estado === "Activo"
        ? "bg-red-600 hover:bg-red-700"
        : "bg-green-600 hover:bg-green-700"
    }`}
  >
    {trabajador.estado === "Activo"
      ? "Desactivar"
      : "Reactivar"}
  </button>
</td>

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default Usuarios
