
function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-8 py-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">
          Panel administrativo
        </h2>
        <p className="text-sm text-slate-500">
          Gestión de tu negocio en un solo lugar
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-semibold text-slate-800">
            Administrador
          </p>
          <p className="text-xs text-slate-500">
            Cuenta de demostración
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
          A
        </div>
      </div>
    </header>
  )
}

export default Header
