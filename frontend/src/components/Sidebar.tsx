
type SidebarProps = {
  activePage: string
  onNavigate: (page: string) => void
}

const menuItems = [
  { icon: "▦", name: "Dashboard" },
  { icon: "🛒", name: "Ventas" },
  { icon: "📦", name: "Productos" },
  { icon: "▤", name: "Inventario" },
  { icon: "🚚", name: "Compras" },
  { icon: "📄", name: "Facturación electrónica" },
  { icon: "⚙", name: "Configuración" },
]

function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="min-h-screen w-64 shrink-0 bg-slate-900 p-5 text-white">
      <div className="mb-10 border-b border-slate-700 pb-5">
        <h1 className="text-xl font-bold text-blue-400">
          ALSHAFACTURAS
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          SaaS PRO
        </p>
      </div>

      <nav aria-label="Menú principal">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => onNavigate(item.name)}
                aria-current={
                  activePage === item.name ? "page" : undefined
                }
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
                  activePage === item.name
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-slate-800"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
}

export default Sidebar
