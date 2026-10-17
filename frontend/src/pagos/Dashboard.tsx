
import StatCard from "../components/StatCard"

const stats = [
  {
    title: "Ventas del día",
    value: "S/ 1,250.00",
    icon: "💰",
    description: "Total vendido hoy",
  },
  {
    title: "Productos registrados",
    value: "120",
    icon: "📦",
    description: "Productos en el catálogo",
  },
  {
    title: "Stock bajo",
    value: "8",
    icon: "⚠️",
    description: "Productos que requieren reposición",
  },
  {
    title: "Comprobantes emitidos",
    value: "35",
    icon: "📄",
    description: "Comprobantes registrados hoy",
  },
]

function Dashboard() {
  return (
    <main className="flex-1 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">
          Resumen del negocio
        </h1>

        <p className="mt-2 text-slate-600">
          Consulta los principales indicadores de tu negocio
        </p>

        <p className="mt-2 text-xs font-medium text-amber-700">
          Datos de demostración
        </p>
      </div>

      <section
        aria-label="Indicadores del negocio"
        className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            icon={stat.icon}
            description={stat.description}
          />
        ))}
      </section>
    </main>
  )
}

export default Dashboard
