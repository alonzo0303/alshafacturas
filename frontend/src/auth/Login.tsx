
import { useState } from "react"

function Login() {
  const [ruc, setRuc] = useState("")
const [correo, setCorreo] = useState("")
const [contrasena, setContrasena] = useState("")


function iniciarSesion(evento: React.FormEvent<HTMLFormElement>) {
  evento.preventDefault()

  if (!/^\d{11}$/.test(ruc)) {
    alert("El RUC debe contener exactamente 11 dígitos.")
    return
  }

  alert(
    "Formulario empresarial validado. " +
    "Próximamente conectaremos la autenticación segura."
  )
}


  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-blue-700">
            ALSHAFACTURAS
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            SaaS PRO
          </p>
          <p className="mt-4 text-slate-500">
            Ingresa a tu cuenta empresarial
          </p>
        </div>
        

        <form onSubmit={iniciarSesion} className="space-y-5">
     
  <div>
    {/* Aquí permanece todo el campo RUC que ya creamos */}
  </div>      
<div>
  <label
    htmlFor="ruc"
    className="mb-2 block text-sm font-medium text-slate-700"
  >
    Número de RUC
  </label>

  <input
    id="ruc"
    type="text"
    inputMode="numeric"
    maxLength={11}
    required
    value={ruc}
    onChange={(evento) => {
      const numeros = evento.target.value.replace(/\D/g, "")
      setRuc(numeros)
    }}
    placeholder="Ingresa los 11 dígitos del RUC"
    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
  />
</div>

          <div>
            <label
              htmlFor="correo"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Correo electrónico
            </label>

            <input
              id="correo"
              type="email"
              required
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              placeholder="usuario@empresa.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="contrasena"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Contraseña
            </label>

            <input
              id="contrasena"
              type="password"
              required
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
            Iniciar sesión
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          © 2026 ALSHAFACTURAS SaaS PRO
        </p>
      </div>
    </main>
  )
}

export default Login
