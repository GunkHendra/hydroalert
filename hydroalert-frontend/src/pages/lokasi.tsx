import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'
import { LoadingSkeleton } from '../components/LoadingSkeleton'
import { connectSocket } from '../lib/socket'

type LocationValue = string | { latitude?: number; longitude?: number } | undefined

type MonitoringDeviceAPI = {
  deviceID?: string
  location?: LocationValue
  lastActive?: string
  water?: { level?: number; status?: string; updatedAt?: string }
}

type MonitoringResponse = {
  success: boolean
  stats?: { totalDevices?: number; activeDevices?: number }
  devices?: MonitoringDeviceAPI[]
}

type Sensor = {
  name: string
  status: string
  waterLevel: number | string
  unit?: string
  updatedAt: string
  location: string
}

const normalizeStatus = (status?: string): string => {
  const normalized = (status || '').toLowerCase()
  if (normalized === 'warning' || normalized === 'bahaya' || normalized === 'waspada') return 'Waspada'
  if (normalized === 'normal') return 'Normal'
  return 'Data tidak ada'
}

const formatLocation = (location: LocationValue): string => {
  if (typeof location === 'string' && location.trim().length) return location
  if (location && typeof location === 'object') {
    const { latitude, longitude } = location
    if (typeof latitude === 'number' && typeof longitude === 'number') return `Lat ${latitude.toFixed(4)}, Lon ${longitude.toFixed(4)}`
  }
  return 'Data tidak ada'
}

const formatAgo = (iso?: string) => {
  if (!iso) return 'Data tidak ada'
  const now = Date.now()
  const past = new Date(iso).getTime()
  const diffMs = now - past
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

const mapSensors = (payload: MonitoringDeviceAPI[]): Sensor[] =>
  payload.map((device) => {
    const level = device.water?.level
    return {
      name: device.deviceID ?? 'Data tidak ada',
      status: normalizeStatus(device.water?.status),
      waterLevel: typeof level === 'number' ? level : 'Data tidak ada',
      unit: typeof level === 'number' ? 'cm' : undefined,
      updatedAt: formatAgo(device.water?.updatedAt || device.lastActive),
      location: formatLocation(device.location),
    }
  })

export default function Lokasi() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const primaryLocation = sensors[0]?.location || 'Data tidak ada'
  const lastUpdatedLabel = sensors[0]?.updatedAt || 'Data tidak ada'

  useEffect(() => {
    let isMounted = true

    const fetchMonitoring = async () => {
      setIsLoading(true)
      try {
        const res = await axios.get<MonitoringResponse>(import.meta.env.VITE_LOCATION_API_URL)
        if (!isMounted) return
        const mapped = mapSensors(res.data?.devices || [])
        setSensors(mapped)
      } catch (error) {
        console.error('Failed to fetch monitoring data', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchMonitoring()
    const intervalId = setInterval(fetchMonitoring, 30000)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const socket = connectSocket()

    const handleSensorUpdate = (payload: MonitoringDeviceAPI) => {
      const mapped = mapSensors([payload])[0]
      setSensors((prev) => {
        const idx = prev.findIndex((s) => s.name === mapped.name)
        if (idx === -1) return [...prev, mapped]
        const next = [...prev]
        next[idx] = mapped
        return next
      })
    }

    socket.on('sensor_data_update', handleSensorUpdate)

    return () => {
      socket.off('sensor_data_update', handleSensorUpdate)
    }
  }, [])

  useEffect(() => {
    const socket = connectSocket()
    const deviceIds = sensors.map((sensor) => sensor.name).filter(Boolean)

    deviceIds.forEach((id) => socket.emit('join_device', id))

    return () => {
      deviceIds.forEach((id) => socket.emit('leave_device', id))
    }
  }, [sensors])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} isMenuOpen={sidebarOpen} />

      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8">
            {isLoading ? (
              <LoadingSkeleton variant="list" />
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">
                <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-lg sm:text-xl font-semibold text-slate-800">Lokasi Perangkat</p>
                    <p className="text-xs sm:text-sm text-slate-500">Peta lokasi sensor sungai dan status terkini</p>
                  </div>
                </header>

                <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
                  <div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-5 py-4 border-b border-slate-100">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <span className="h-8 w-8 rounded-full bg-cyan-500 text-white grid place-items-center text-lg font-bold">📍</span>
                        <span>Peta Lokasi Sensor</span>
                      </div>
                      <span className="text-xs text-slate-500">{primaryLocation}</span>
                    </div>
                    <div className="relative bg-slate-100">
                      <div className="relative w-full" style={{ paddingTop: '65%' }}>
                        <iframe
                          src="https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d1412.9869120280778!2d115.19615081775672!3d-8.694315793914992!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sid!4v1769101621008!5m2!1sen!2sid"
                          className="absolute inset-0 h-full w-full border-0"
                          title="Peta Lokasi Sensor"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allowFullScreen
                        />
                      </div>
                      <div className="absolute bottom-4 left-4 rounded-xl bg-white/90 backdrop-blur border border-slate-200 shadow-sm p-4 text-sm text-slate-700">
                        <p className="font-semibold text-slate-800 mb-2">Legend Status</p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-emerald-500" /> Normal
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-amber-500" /> Peringatan
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="h-3 w-3 rounded-full bg-red-500" /> Bahaya
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm sm:text-base font-semibold text-slate-800">Daftar Sensor</p>
                      <span className="text-[11px] sm:text-xs text-slate-500">Diperbarui {lastUpdatedLabel}</span>
                    </div>

                    <div className="space-y-3">
                      {sensors.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Data tidak ada</div>
                      ) : (
                        sensors.map((sensor) => {
                          const isNormal = sensor.status === 'Normal'
                          return (
                            <div
                              key={sensor.name}
                              className={`rounded-2xl border p-4 shadow-sm flex flex-col gap-3 ${
                                isNormal ? 'border-emerald-200' : 'border-amber-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{sensor.name}</p>
                                  <p className="text-xs text-slate-500">{sensor.location}</p>
                                </div>
                                <span
                                  className={`text-[10px] sm:text-[11px] font-semibold px-3 py-1 rounded-full ${
                                    isNormal ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                  }`}
                                >
                                  {sensor.status}
                                </span>
                              </div>

                              <div className="rounded-xl bg-linear-to-r from-sky-500 to-blue-600 text-white px-3 sm:px-4 py-3 flex items-center justify-between">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-white/80">Ketinggian Air</p>
                                  <div className="flex items-end gap-2">
                                    <span className="text-3xl sm:text-4xl font-black leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.25)]">{sensor.waterLevel}</span>
                                    {typeof sensor.waterLevel === 'number' && sensor.unit && (
                                      <span className="text-base sm:text-lg font-semibold">{sensor.unit}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-xs text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span className="h-2 w-2 rounded-full bg-slate-300" />
                                  Diperbarui {sensor.updatedAt}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>

          <footer className="border-t border-slate-200 bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/60 px-8 py-4 text-sm text-slate-500 flex items-center justify-end gap-6">
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
