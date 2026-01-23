import logo from '../assets/logo.svg'

export function Navbar({ onMenuToggle, isMenuOpen }: { onMenuToggle?: () => void; isMenuOpen?: boolean }) {
  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <button
            type="button"
            onClick={onMenuToggle}
            aria-label="Toggle menu"
            aria-expanded={isMenuOpen}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-700 bg-white shadow-sm hover:bg-slate-50"
          >
            <span className="sr-only">Toggle navigation</span>
            <span className="space-y-1.5">
              <span className="block h-0.5 w-5 bg-current rounded" />
              <span className="block h-0.5 w-5 bg-current rounded" />
              <span className="block h-0.5 w-5 bg-current rounded" />
            </span>
          </button>
        )}
        <img src={logo} alt="HydroAlert" className="h-10 w-10" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800">HydroAlert</p>
        </div>
      </div>
    </header>
  )
}
