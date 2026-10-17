
import { useState } from "react"

const ventasDemo = [
  {
    id: "V-001",
    cliente: "Cliente general",
    fecha: "17/10/2026",
    total: 120.0,
    estado: "Pagada",
  },
  {
    id: "V-002",
    cliente: "María López",
    fecha: "17/10/2026",
    total: 85.5,
    estado: "Pendiente",
  },
  {
    id: "V-003",
    cliente: "Juan Pérez",
    fecha: "17/10/2026",
    total: 230.0,
    estado: "Pagada",
  },
]

function Ventas() {
  const [busqueda, setBusqueda] = useState("")

  const [ventas, setVentas] = useState(ventasDemo)

const [mostrarFormulario, setMostrarFormulario] = useState(false)

const [cliente, setCliente] = useState("")

const [total, setTotal] = useState("")


const ventasFiltradas = ventas.filter((venta) =>
  `${venta.id} ${venta.cliente} ${venta.estado}`
    .toLowerCase()
    .includes(busqueda.toLowerCase())
)

function registrarVenta(evento: React.FormEvent<HTMLFormElement>) {
  evento.preventDefault()

  const monto = Number(total)

  if (!cliente.trim() || !Number.isFinite(monto) || monto <= 0) {
    alert("Ingresa un cliente y un monto válido.")
    return
  }

  const nuevaVenta = {
    id: `V-${String(ventas.length + 1).padStart(3, "0")}`,
    cliente: cliente.trim(),
    fecha: new Date().toLocaleDateString("es-PE"),
    total: monto,
    estado: "Pendiente",
  }

  setVentas([...ventas, nuevaVenta])
  setCliente("")
  setTotal("")
  setMostrarFormulario(false)
}


  return (
    <main className="flex-1 p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Gestión de ventas
          </h1>

          <p className="mt-2 text-slate-600">
            Consulta las operaciones realizadas en tu negocio.
          </p>

          <p className="mt-2 text-xs font-medium text-amber-700">
            Datos de demostración
          </p>
        </div>

       
<button
  type="button"
  onClick={() => setMostrarFormulario(true)}
  className="rounded-lg bg-blue-600 px-5 py-3 font-medium text-white hover:bg-blue-700"
>
  + Nueva venta
</button>

      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5">
          <label
            htmlFor="buscar-ventas"
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Buscar venta
          </label>

          <input
            id="buscar-ventas"
            type="search"
            placeholder="Buscar por número, cliente o estado..."
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            className="w-full max-w-md rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="p-4">N.º venta</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Fecha</th>
                <th className="p-4">Total</th>
                <th className="p-4">Estado</th>
              </tr>
            </thead>

            <tbody>
              {ventasFiltradas.map((venta) => (
                <tr
                  key={venta.id}
                  className="border-t border-slate-100"
                >
                  <td className="p-4 font-medium">{venta.id}</td>
                  <td className="p-4">{venta.cliente}</td>
                  <td className="p-4">{venta.fecha}</td>
                  <td className="p-4">
                    S/ {venta.total.toFixed(2)}
                  </td>
                  <td className="p-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        venta.estado === "Pagada"
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {venta.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {ventasFiltradas.length === 0 && (
            <p className="py-8 text-center text-slate-500">
              No se encontraron ventas.
            </p>
          )}
        </div>
      </section>
      
{mostrarFormulario && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
      <h2 className="text-2xl font-bold text-slate-800">
        Nueva venta
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        Registro de demostración
      </p>

      <form onSubmit={registrarVenta} className="mt-6 space-y-4">
        <div>
          <label htmlFor="cliente" className="mb-2 block text-sm font-medium">
            Cliente
          </label>

          <input
            id="cliente"
            type="text"
            required
            value={cliente}
            onChange={(evento) => setCliente(evento.target.value)}
            placeholder="Nombre del cliente"
            className="w-full rounded-lg border border-slate-300 px-4 py-3"
          />
        </div>

        <div>
          <label htmlFor="total" className="mb-2 block text-sm font-medium">
            Total de la venta (S/)
          </label>

          <input
            id="total"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={total}
            onChange={(evento) => setTotal(evento.target.value)}
            placeholder="0.00"
            className="w-full rounded-lg border border-slate-300 px-4 py-3"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => setMostrarFormulario(false)}
            className="rounded-lg border border-slate-300 px-4 py-2"
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white"
          >
            Guardar venta
          </button>
        </div>
      </form>
    </div>
  </div>
)}

    </main>
  )
}

export default Ventas
