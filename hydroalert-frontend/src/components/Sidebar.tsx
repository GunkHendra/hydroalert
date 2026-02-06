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

export function Sidebar({ items = defaultNavItems, isOpen = false, onClose }: { items?: NavItem[]; isOpen?: boolean; onClose?: () => void }) {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 bg-white border-r border-slate-200 flex flex-col shadow-lg transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 md:shadow-none md:border-b md:border-slate-200 md:bg-white md:overflow-y-auto`}
      >
        <div className="px-4 pt-5 pb-3 text-xs font-semibold text-slate-500 uppercase tracking-[0.18em]">Menu Utama</div>
        <nav className="flex-1 px-3 pb-4 space-y-1 text-sm">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
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

      {isOpen && <button type="button" aria-label="Tutup menu" className="fixed inset-0 z-20 bg-slate-900/40 backdrop-blur-sm md:hidden" onClick={onClose} />}
    </>
  )
}
