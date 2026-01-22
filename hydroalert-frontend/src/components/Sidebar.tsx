import { NavLink } from 'react-router-dom'
import berandaIcon from '../assets/beranda.svg'
import pemantauanIcon from '../assets/pemantauan.svg'
import lokasiIcon from '../assets/lokasi.svg'
import riwayatIcon from '../assets/riwayat.svg'

export type NavItem = {
  label: string
  path: string
  icon?: string
}

const defaultNavItems: NavItem[] = [
  { label: 'Beranda', path: '/', icon: berandaIcon },
  { label: 'Pemantauan', path: '/pemantauan', icon: pemantauanIcon },
  { label: 'Lokasi Perangkat', path: '/lokasi-perangkat', icon: lokasiIcon },
  { label: 'Riwayat Notifikasi', path: '/riwayat-notifikasi', icon: riwayatIcon },
]

export function Sidebar({ items = defaultNavItems }: { items?: NavItem[] }) {
  return (
    <aside className="w-60 bg-white border-r border-slate-200 flex flex-col">
      <div className="px-4 pt-5 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">Menu Utama</div>
      <nav className="flex-1 px-3 pb-4 space-y-1 text-sm">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2 rounded-lg transition text-left border ${
                isActive ? 'bg-cyan-50 text-cyan-700 border-cyan-100 shadow-sm' : 'text-slate-600 hover:bg-slate-50 border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`h-8 w-8 rounded-lg grid place-items-center ${
                    isActive ? 'bg-white border border-cyan-100 text-cyan-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.icon ? <img src={item.icon} alt="" className="h-4 w-4" /> : '[]'}
                </span>
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
