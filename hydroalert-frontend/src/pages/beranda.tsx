import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'

type Notification = {
  title: string
  description: string
  status: 'normal' | 'warning'
  time: string
}

const notifications: Notification[] = [
  {
    title: 'Sistem Normal',
    description: 'Semua sensor berfungsi dengan baik',
    status: 'normal',
    time: '5 menit lalu',
  },
  {
    title: 'Peringatan Hujan Sedang',
    description: 'Intensitas hujan 25 mm/jam terdeteksi',
    status: 'warning',
    time: '15 menit lalu',
  },
  {
    title: 'Sensor Diperbarui',
    description: 'Firmware sensor hujan versi 1.0.2',
    status: 'normal',
    time: '40 menit lalu',
  },
]

const sensors = [
  { id: 1, label: '1', status: 'Aktif' },
  { id: 2, label: '2', status: 'Aktif' },
  { id: 3, label: '3', status: 'Aktif' },
]

function App() {
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <Navbar />

      <div className="flex flex-1">
        <Sidebar />

        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-8 space-y-6">
            <header className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-lg font-semibold text-slate-800">Ketinggian Air yang Patut Diwaspadai</p>
              </div>
              <div className="text-lg font-semibold text-slate-800">Perangkat A</div>
            </header>

          <section className="grid gap-6">
            <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 min-h-[260px]">
              <div className="relative z-10 p-6 pt-7 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-2 self-start">
                  <div className="flex items-end gap-3">
                    <span className="text-6xl font-black leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
                      155
                    </span>
                    <span className="text-2xl font-semibold text-slate-700">cm</span>
                  </div>
                </div>

                <div className="flex-1 flex justify-end self-center">
                  <div className="flex items-center gap-3 bg-gradient-to-r from-orange-500 to-red-500 px-7 py-3 rounded-full shadow-lg shadow-orange-600/40 border border-orange-100">
                    <span className="text-lg font-black uppercase tracking-[0.2em] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
                      Waspada
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute inset-0">
                <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-44 w-full">
                  <path
                    d="M0 70 C150 120 250 30 400 90 C500 140 550 90 600 120 V200 H0 Z"
                    fill="#0ea5e9"
                  />
                  <path
                    d="M0 110 C130 70 230 150 370 80 C490 40 540 140 600 110 V200 H0 Z"
                    fill="#0284c7"
                  />
                </svg>
              </div>

              <p className="absolute bottom-3 left-6 z-10 text-xs text-white">Terakhir diperbaharui: 10.00</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Kecepatan Angin</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold text-slate-900">25</span>
                      <span className="text-base text-slate-500">km/jam</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    Sedang
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-full w-1/3 rounded-full bg-purple-500" />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Tenang</span>
                  <span>Kencang</span>
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Debit Air Hujan</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold text-slate-900">25</span>
                      <span className="text-base text-slate-500">mm/jam</span>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                    Sedang
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100">
                  <div className="h-full w-1/2 rounded-full bg-sky-500" />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Gerimis</span>
                  <span>Lebat</span>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 flex flex-col gap-4 min-h-[280px]">
                <div className="flex items-start justify-between">
                  <div className="space-y-7">
                    <p className="text-sm text-slate-500">Jumlah Alat Aktif</p>
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold text-slate-900">3</span>
                      <span className="text-base text-slate-500">/ 3</span>
                    </div>
                    <p className="text-xs text-slate-500">Unit Sensor</p>
                    
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                    100%
                  </span>
                </div>
                <div className="flex-1" />
                <div className="flex items-center gap-3 text-xs">
                  {sensors.map((sensor) => (
                    <span
                      key={sensor.id}
                      className={`flex-1 rounded-lg border px-3 py-2 text-center font-semibold ${
                        sensor.status === 'Aktif'
                          ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                          : 'border-amber-300 text-amber-700 bg-amber-50'
                      }`}
                    >
                      {sensor.label}
                    </span>
                  ))}
                </div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500" />
                    Aktif
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-amber-400" />
                    Dalam Pemeliharaan
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Notifikasi Terkini</p>
                  <span className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-semibold">
                    3
                  </span>
                </div>

                <div className="space-y-3">
                  {notifications.map((item) => (
                    <div
                      key={item.title}
                      className={`rounded-xl border px-4 py-3 shadow-sm flex items-start justify-between gap-3 ${
                        item.status === 'normal'
                          ? 'border-emerald-200 bg-emerald-50/70'
                          : 'border-orange-200 bg-orange-50/80'
                      }`}
                    >
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                        <p className="text-xs text-slate-600">{item.description}</p>
                      </div>
                      <span
                        className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                          item.status === 'normal'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-orange-100 text-orange-700'
                        }`}
                      >
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          </main>

          <footer className="border-t border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-8 py-4 text-sm text-slate-500 flex items-center justify-end gap-6">
            <a className="hover:text-slate-700" href="#">
              About HydroAlert
            </a>
            <a className="hover:text-slate-700" href="#">
              Contact Us
            </a>
          </footer>
        </div>
      </div>
    </div>
  )
}

export default App
