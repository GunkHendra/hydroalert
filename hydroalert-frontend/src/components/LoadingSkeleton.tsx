type SkeletonVariant = 'dashboard' | 'monitoring' | 'list'

type LoadingSkeletonProps = {
  variant?: SkeletonVariant
}

const Block = ({ className }: { className: string }) => <div className={`bg-slate-200 rounded ${className}`} />

const DashboardSkeleton = () => (
  <section className="grid gap-4 sm:gap-5 lg:gap-6 animate-pulse">
    <div className="rounded-2xl bg-white shadow-lg border border-slate-200 p-6 min-h-65">
      <Block className="h-8 w-32 mb-4" />
      <Block className="h-14 w-48" />
    </div>
    <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
        <Block className="h-4 w-24" />
        <Block className="h-10 w-32" />
        <Block className="h-3 w-full" />
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
        <Block className="h-4 w-28" />
        <Block className="h-10 w-32" />
        <Block className="h-3 w-full" />
      </div>
    </div>
    <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-4 min-h-70">
        <Block className="h-4 w-28" />
        <Block className="h-10 w-40" />
        <Block className="h-3 w-full" />
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Block className="h-4 w-28" />
          <Block className="h-6 w-6 rounded-full" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
              <Block className="h-4 w-32" />
              <Block className="h-3 w-40" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)

const MonitoringSkeleton = () => (
  <section className="space-y-5 sm:space-y-6 animate-pulse">
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {[...Array(3)].map((_, idx) => (
          <Block key={idx} className="h-8 w-28" />
        ))}
      </div>
    </div>

    <div className="relative rounded-2xl bg-white shadow-lg border border-slate-200 p-6 min-h-55 space-y-4">
      <Block className="h-4 w-44" />
      <Block className="h-12 w-32" />
      <Block className="h-8 w-36" />
    </div>

    <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
      {[...Array(2)].map((_, idx) => (
        <div key={idx} className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
          <Block className="h-4 w-32" />
          <Block className="h-10 w-28" />
          <Block className="h-3 w-full" />
        </div>
      ))}
    </div>

    <div className="grid gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
        <Block className="h-64 w-full" />
        <Block className="h-4 w-48" />
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-4">
        <Block className="h-8 w-32" />
        <Block className="h-56 w-full" />
        <Block className="h-4 w-40" />
      </div>
    </div>
  </section>
)

const ListSkeleton = () => (
  <section className="animate-pulse space-y-5 sm:space-y-6">
    <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 space-y-3">
          <Block className="h-4 w-44" />
          <Block className="h-4 w-32" />
        </div>
        <Block className="h-80 w-full" />
      </div>
      <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Block className="h-4 w-28" />
          <Block className="h-3 w-24" />
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
              <Block className="h-4 w-40" />
              <Block className="h-3 w-32" />
              <Block className="h-10 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)

export const LoadingSkeleton = ({ variant = 'dashboard' }: LoadingSkeletonProps) => {
  if (variant === 'monitoring') return <MonitoringSkeleton />
  if (variant === 'list') return <ListSkeleton />
  return <DashboardSkeleton />
}
