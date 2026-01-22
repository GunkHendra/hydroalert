import logo from '../assets/logo.svg'

export function Navbar() {
  return (
    <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <img src={logo} alt="HydroAlert" className="h-10 w-10" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-slate-800">HydroAlert</p>
        </div>
      </div>
    </header>
  )
}
