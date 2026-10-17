
type StatCardProps = {
  title: string
  value: string
  icon: string
  description: string
}

function StatCard({
  title,
  value,
  icon,
  description,
}: StatCardProps) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <span
          className="text-2xl"
          aria-hidden="true"
        >
          {icon}
        </span>
      </div>

      <h3 className="text-3xl font-bold text-slate-800">
        {value}
      </h3>

      <p className="mt-2 text-xs text-slate-500">
        {description}
      </p>
    </article>
  )
}

export default StatCard
