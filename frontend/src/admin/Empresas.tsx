
import { useState, type FormEvent } from "react"

type Empresa = {
  id: number
  ruc: string
  razonSocial: string
  rubro: string
  plan: string
  administradorNombre: string
administradorCorreo: string
  estado: "Activa" | "Suspendida"
}

function Empresas() {
  const [ruc, setRuc] = useState("")
  const [razonSocial, setRazonSocial] = useState("")
  const [rubro, setRubro] = useState("")
  const [plan, setPlan] = useState("Basico")
const [empresas, setEmpresas] = useState<Empresa[]>([])
const [administradorNombre, setAdministradorNombre] = useState("")
const [administradorCorreo, setAdministradorCorreo] = useState("")
   
function registrarEmpresa(evento: FormEvent<HTMLFormElement>) {
  evento.preventDefault()   

  if (!/^\d{11}$/.test(ruc)) {
    alert("El RUC debe contener exactamente 11 dígitos.")
    return
  }

  if (empresas.some((empresa) => empresa.ruc === ruc)) {
    alert("Ya existe una empresa con este RUC.")
    return
  }

  
const nuevaEmpresa: Empresa = {
  id: Date.now(),
  ruc,
  razonSocial: razonSocial.trim(),
  rubro,
  plan,
  administradorNombre: administradorNombre.trim(),
  administradorCorreo: administradorCorreo.trim().toLowerCase(),
  estado: "Activa",
}

  setEmpresas((anteriores) => [...anteriores, nuevaEmpresa])

  setRuc("")
  setRazonSocial("")
  setRubro("")
  setPlan("Basico")
  setAdministradorNombre("")
setAdministradorCorreo("")
}


function cambiarEstadoEmpresa(id: number) {
  const empresa = empresas.find((item) => item.id === id)

  if (!empresa) return

  const accion =
    empresa.estado === "Activa" ? "suspender" : "reactivar"

  const confirmado = window.confirm(
    `¿Estás seguro de que deseas ${accion} a ${empresa.razonSocial}?`
  )

  if (!confirmado) return

  setEmpresas((anteriores) =>
    anteriores.map((item) =>
      item.id === id
        ? {
            ...item,
            estado:
              item.estado === "Activa" ? "Suspendida" : "Activa",
          }
        : item
    )
  )
}



  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Administración de empresas
          </h1>
          <p className="mt-2 text-slate-500">
            Registra nuevas empresas en ALSHAFACTURAS SaaS PRO.
          </p>
        </header>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">
            Nueva empresa
          </h2>

          <form onSubmit={registrarEmpresa} className="space-y-5">
            <div>
              <label
                htmlFor="empresa-ruc"
                className="mb-2 block text-sm font-medium"
              >
                RUC
              </label>
              <input
                id="empresa-ruc"
                type="text"
                inputMode="numeric"
                maxLength={11}
                required
                value={ruc}
                onChange={(evento) =>
                  setRuc(evento.target.value.replace(/\D/g, ""))
                }
                placeholder="11 dígitos"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="razon-social"
                className="mb-2 block text-sm font-medium"
              >
                Razón social
              </label>
              <input
                id="razon-social"
                type="text"
                required
                value={razonSocial}
                onChange={(evento) =>
                  setRazonSocial(evento.target.value)
                }
                placeholder="Nombre legal de la empresa"
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              />
            </div>

            <div>
              <label
                htmlFor="rubro"
                className="mb-2 block text-sm font-medium"
              >
                Rubro
              </label>
              <select
                id="rubro"
                required
                value={rubro}
                onChange={(evento) => setRubro(evento.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              >
                <option value="">Selecciona un rubro</option>
                <option value="Automotriz">Automotriz</option>
                <option value="Industrial">Industrial</option>
                <option value="Mineria">Minería</option>
                <option value="Comercio">Comercio</option>
                <option value="Servicios">Servicios</option>
                <option value="Otro">Otro</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="plan"
                className="mb-2 block text-sm font-medium"
              >
                Plan de suscripción
              </label>
              <select
                id="plan"
                value={plan}
                onChange={(evento) => setPlan(evento.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-3"
              >
                <option value="Basico">Básico</option>
                <option value="Pro">Pro</option>
                <option value="Business">Business</option>
              </select>
            </div>
            
<div className="border-t border-slate-200 pt-5">
  <h3 className="mb-4 text-lg font-semibold text-slate-800">
    Administrador inicial de la empresa
  </h3>

  <div className="space-y-4">
    <div>
      <label
        htmlFor="administrador-nombre"
        className="mb-2 block text-sm font-medium"
      >
        Nombre completo del administrador
      </label>

      <input
        id="administrador-nombre"
        type="text"
        required
        value={administradorNombre}
        onChange={(evento) =>
          setAdministradorNombre(evento.target.value)
        }
        placeholder="Ejemplo: Carlos Ramírez"
        className="w-full rounded-lg border border-slate-300 px-4 py-3"
      />
    </div>

    <div>
      <label
        htmlFor="administrador-correo"
        className="mb-2 block text-sm font-medium"
      >
        Correo del administrador
      </label>

      <input
        id="administrador-correo"
        type="email"
        required
        value={administradorCorreo}
        onChange={(evento) =>
          setAdministradorCorreo(evento.target.value)
        }
        placeholder="administrador@empresa.com"
        className="w-full rounded-lg border border-slate-300 px-4 py-3"
      />
    </div>
  </div>
</div>

            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white hover:bg-blue-800"
            >
              Registrar empresa
            </button>
          </form>
        </section>
        
<section className="mt-8 rounded-xl bg-white p-6 shadow-sm">
  <h2 className="mb-5 text-xl font-semibold text-slate-800">
    Empresas registradas
  </h2>

  {empresas.length === 0 ? (
    <p className="text-sm text-slate-500">
      Todavía no hay empresas registradas.
    </p>
  ) : (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="p-3">Razón social</th>
            <th className="p-3">Administrador</th>
            <th className="p-3">RUC</th>
            <th className="p-3">Rubro</th>
            <th className="p-3">Plan</th>
            <th className="p-3">Estado</th>
            <th className="p-3">Acciones</th>
          </tr>
        </thead>

        <tbody>
          {empresas.map((empresa) => (
            <tr key={empresa.id} className="border-b">
              <td className="p-3">{empresa.razonSocial}</td>
              
<td className="p-3">
  <p className="font-medium text-slate-800">
    {empresa.administradorNombre}
  </p>
  <p className="text-xs text-slate-500">
    {empresa.administradorCorreo}
  </p>
</td>

              <td className="p-3">{empresa.ruc}</td>
              <td className="p-3">{empresa.rubro}</td>
              <td className="p-3">{empresa.plan}</td>
             
<td className="p-3">
  <span
    className={`rounded-full px-3 py-1 ${
      empresa.estado === "Activa"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700"
    }`}
  >
    {empresa.estado}
  </span>
</td>

<td className="p-3">
  <button
    type="button"
    onClick={() => cambiarEstadoEmpresa(empresa.id)}
    className={`rounded-lg px-3 py-2 text-sm font-medium text-white ${
      empresa.estado === "Activa"
        ? "bg-red-600 hover:bg-red-700"
        : "bg-green-600 hover:bg-green-700"
    }`}
  >
    {empresa.estado === "Activa" ? "Suspender" : "Reactivar"}
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

export default Empresas
