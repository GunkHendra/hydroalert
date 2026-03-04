import { useEffect, useState } from 'react'
import axios from 'axios'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'
import { connectSocket } from '../lib/socket'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

type Notification = {
  title: string
  description: string
  status: 'normal' | 'warning'
  time?: string
  dateLabel?: string
  dateISO?: string
}

type PredictionState = {
  deviceID: string
  fromStatus: string
  toStatus: string
  toWaterLevel: number | null
  estimatedMinutes: number
  currentLevel: number | null
  riseRate: number | null
  updatedAt?: string
}

const PREDICTION_CACHE_KEY = 'hydroalert_prediction_cache'
const PREDICTION_MAX_MINUTES = 120

type BackendPrediction = {
  fromStatus?: string
  toStatus?: string
  waterLevel?: number
  toWaterLevel?: number
  estimatedMinutes?: number
  adjustedRiseRate?: number | string
}

type DashboardResponse = {
  success: boolean
  data: {
    deviceID: string
    water: { level: number; status: string; updatedAt: string }
    wind: { speed: number }
    rain: { intensity: number }
    devices: { total: number; active: number }
    notifications: Partial<Notification>[]
    prediction?: BackendPrediction | null
  }
}

const normalizePrediction = (deviceID: string | null | undefined, pred?: BackendPrediction | null): PredictionState | null => {
  if (!deviceID || !pred) return null
  const estimated = typeof pred.estimatedMinutes === 'number' ? pred.estimatedMinutes : Number(pred.estimatedMinutes ?? NaN)
  if (!Number.isFinite(estimated) || estimated <= 0 || estimated > PREDICTION_MAX_MINUTES) return null

  const toWaterLevel = typeof pred.toWaterLevel === 'number' ? pred.toWaterLevel : Number(pred.toWaterLevel ?? NaN)
  const currentLevel = typeof pred.waterLevel === 'number' ? pred.waterLevel : Number(pred.waterLevel ?? NaN)
  const riseRate = typeof pred.adjustedRiseRate === 'number' ? pred.adjustedRiseRate : Number(pred.adjustedRiseRate ?? NaN)

  return {
    deviceID,
    fromStatus: pred.fromStatus ?? 'Data Tidak Tersedia',
    toStatus: pred.toStatus ?? 'Data Tidak Tersedia',
    toWaterLevel: Number.isFinite(toWaterLevel) ? toWaterLevel : null,
    estimatedMinutes: Math.round(estimated),
    currentLevel: Number.isFinite(currentLevel) ? currentLevel : null,
    riseRate: Number.isFinite(riseRate) ? riseRate : null,
    updatedAt: new Date().toISOString(),
  }
}

const loadCachedPrediction = (deviceID: string): PredictionState | null => {
  try {
    const raw = localStorage.getItem(PREDICTION_CACHE_KEY)
    if (!raw) return null
    const cache = JSON.parse(raw) as Record<string, PredictionState>
    const cached = cache[deviceID]
    if (!cached) return null
    if (cached.estimatedMinutes > PREDICTION_MAX_MINUTES) return null
    return cached
  } catch (e) {
    console.warn('Failed to load cached prediction', e)
    return null
  }
}

const writePredictionCache = (deviceID: string, prediction: PredictionState | null) => {
  try {
    const raw = localStorage.getItem(PREDICTION_CACHE_KEY)
    const cache = raw ? (JSON.parse(raw) as Record<string, PredictionState>) : {}
    if (prediction) {
      cache[deviceID] = prediction
    } else {
      delete cache[deviceID]
    }
    localStorage.setItem(PREDICTION_CACHE_KEY, JSON.stringify(cache))
  } catch (e) {
    console.warn('Failed to write cached prediction', e)
  }
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardResponse['data'] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [prediction, setPrediction] = useState<PredictionState | null>(null)

  const notifications: Notification[] = (dashboard?.notifications ?? []).map((item) => ({
    title: item.title ?? 'Notifikasi',
    description: item.description ?? '- ',
    status: item.status ?? 'normal',
    time: item.time,
    dateLabel: item.dateLabel,
    dateISO: item.dateISO,
  }))
  const shouldScrollNotifications = notifications.length > 2
  const shouldShowPredictionCard = Boolean(prediction && prediction.estimatedMinutes <= PREDICTION_MAX_MINUTES)

  useEffect(() => {
    let isMounted = true

    const fetchDashboard = async () => {
      setIsLoading(true)
      try {
        const res = await axios.get<DashboardResponse>(import.meta.env.VITE_BERANDA_API_URL)
        if (isMounted && res.data?.data) {
          const mappedNotifications = (res.data.data.notifications || []).map((item) => {
            const severity = (item as any).severity as string | undefined
            const createdAt = (item as any).createdAt as string | undefined

            return {
              title: (item as any).title ?? 'Notifikasi',
              description: (item as any).description ?? (item as any).message ?? '-',
              status: severity && severity.toLowerCase() !== 'normal' ? 'warning' : 'normal',
              time: createdAt ? formatUpdatedAt(createdAt) : undefined,
              dateLabel: createdAt ? formatDateLabel(createdAt) : undefined,
              dateISO: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : undefined,
            } as Notification
          })

          setDashboard({
            ...res.data.data,
            notifications: mappedNotifications,
          })

          const deviceID = res.data.data.deviceID
          if (deviceID) {
            const normalized = normalizePrediction(deviceID, res.data.data.prediction)
            if (normalized) {
              setPrediction(normalized)
              writePredictionCache(deviceID, normalized)
            } else {
              setPrediction(null)
              writePredictionCache(deviceID, null)
            }
          } else {
            setPrediction(null)
          }
        }
      } catch (error) {
        console.error('Failed to fetch dashboard', error)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    fetchDashboard()
    const intervalId = setInterval(fetchDashboard, 30000)

    return () => {
      isMounted = false
      clearInterval(intervalId)
    }
  }, [])

  useEffect(() => {
    const socket = connectSocket()

    socket.emit('join_dashboard')
    socket.emit('join_notifications')

    const handleTotalDevices = (payload: any) => {
      setDashboard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          devices: {
            ...prev.devices,
            total: payload?.devices?.total ?? prev.devices.total,
          },
        }
      })
    }

    const handleActiveDevices = (payload: any) => {
      setDashboard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          devices: {
            ...prev.devices,
            active: payload?.devices?.active ?? prev.devices.active,
          },
        }
      })
    }

    const handleOverallData = (payload: any) => {
      setDashboard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          water: payload?.water ? { ...prev.water, ...payload.water } : prev.water,
          wind: payload?.wind ? { ...prev.wind, ...payload.wind } : prev.wind,
          rain: payload?.rain ? { ...prev.rain, ...payload.rain } : prev.rain,
        }
      })
    }

    const handleNewNotification = (notif: any) => {
      const severity = (notif?.severity as string | undefined) || (notif?.status as string | undefined)
      const createdAt = notif?.createdAt as string | undefined
      const mapped: Notification = {
        title: notif?.title ?? 'Notifikasi',
        description: notif?.message ?? notif?.description ?? '-',
        status: severity && severity.toLowerCase() !== 'normal' ? 'warning' : 'normal',
        time: createdAt ? formatUpdatedAt(createdAt) : undefined,
        dateLabel: createdAt ? formatDateLabel(createdAt) : undefined,
        dateISO: createdAt ? new Date(createdAt).toISOString().slice(0, 10) : undefined,
      }

      setDashboard((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          notifications: [mapped, ...(prev.notifications || [])],
        }
      })
    }

    socket.on('update_total_device', handleTotalDevices)
    socket.on('update_active_device', handleActiveDevices)
    socket.on('update_overall_sensor_data', handleOverallData)
    socket.on('new_notification', handleNewNotification)

    return () => {
      socket.off('update_total_device', handleTotalDevices)
      socket.off('update_active_device', handleActiveDevices)
      socket.off('update_overall_sensor_data', handleOverallData)
      socket.off('new_notification', handleNewNotification)
      socket.emit('leave_dashboard')
      socket.emit('leave_notifications')
    }
  }, [])

  useEffect(() => {
    const socket = connectSocket()
    const deviceID = dashboard?.deviceID

    if (!deviceID) {
      setPrediction(null)
      return
    }

    const cached = loadCachedPrediction(deviceID)
    if (cached) setPrediction(cached)

    const handlePrediction = (payload: any) => {
      const pred = payload?.prediction
      if (!pred || payload?.deviceID !== deviceID) return

      const normalized = normalizePrediction(deviceID, pred)

      if (!normalized) {
        setPrediction(null)
        writePredictionCache(deviceID, null)
        return
      }

      setPrediction(normalized)
      writePredictionCache(deviceID, normalized)
    }

    socket.emit('join_device', deviceID)
    socket.on('water_level_prediction', handlePrediction)

    return () => {
      socket.off('water_level_prediction', handlePrediction)
      socket.emit('leave_device', deviceID)
    }
  }, [dashboard?.deviceID])

  const formatUpdatedAt = (iso: string | undefined) => {
    if (!iso) return '-'
    const date = new Date(iso)
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDateLabel = (iso: string | undefined) => {
    if (!iso) return 'Tanggal tidak diketahui'
    const date = new Date(iso)
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  }

  const formatEta = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return '(Perkiraan waktu tidak tersedia)'
    if (minutes < 1) return 'kurang dari 1 menit'
    if (minutes < 60) return `${minutes} menit lagi`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours >= 24) return `${Math.floor(hours / 24)} hari ${hours % 24} jam lagi`
    return mins ? `${hours} jam ${mins} menit lagi` : `${hours} jam lagi`
  }

  const computeWindVisuals = (speed: number | undefined) => {
    if (typeof speed !== 'number' || Number.isNaN(speed)) {
      return { label: 'Data Tidak Tersedia', badgeClass: 'bg-slate-200 text-slate-500', barWidth: '0%' }
    }
    if (speed <= 0) return { label: 'Tidak ada angin', badgeClass: 'bg-slate-200 text-slate-500', barWidth: '0%' }
    if (speed < 10) return { label: 'Tenang', badgeClass: 'bg-emerald-100 text-emerald-700', barWidth: '25%' }
    if (speed < 20) return { label: 'Sedang', badgeClass: 'bg-amber-100 text-amber-700', barWidth: '55%' }
    return { label: 'Kencang', badgeClass: 'bg-rose-100 text-rose-700', barWidth: '85%' }
  }

  const computeRainVisuals = (intensity: number | undefined) => {
    if (typeof intensity !== 'number' || Number.isNaN(intensity)) {
      return { label: 'Data Tidak Tersedia', badgeClass: 'bg-slate-200 text-slate-500', barWidth: '0%' }
    }
    if (intensity <= 0) return { label: 'Tidak ada hujan', badgeClass: 'bg-slate-200 text-slate-500', barWidth: '0%' }
    if (intensity < 2) return { label: 'Gerimis', badgeClass: 'bg-emerald-100 text-emerald-700', barWidth: '30%' }
    if (intensity < 10) return { label: 'Sedang', badgeClass: 'bg-amber-100 text-amber-700', barWidth: '60%' }
    return { label: 'Lebat', badgeClass: 'bg-rose-100 text-rose-700', barWidth: '90%' }
  }

  const computeWaterBadge = (status: string | undefined) => {
    const label = status ? status.toUpperCase() : '---'
    if (!status) return { label, badgeClass: 'bg-slate-200 text-slate-700 border border-slate-300 shadow-sm' }
    const lower = status.toLowerCase()
    if (lower.includes('bahaya') || lower.includes('danger')) {
      return { label, badgeClass: 'bg-linear-to-r from-red-500 to-orange-500 text-white border border-orange-100 shadow-orange-600/40' }
    }
    if (lower.includes('siaga') || lower.includes('warning') || lower.includes('waspada')) {
      return { label, badgeClass: 'bg-linear-to-r from-amber-400 to-orange-500 text-white border border-amber-100 shadow-amber-500/40' }
    }
    return { label, badgeClass: 'bg-linear-to-r from-emerald-500 to-teal-500 text-white border border-emerald-100 shadow-emerald-600/30' }
  }

  const computeDeviceBadge = (total: number | undefined, active: number | undefined) => {
    if (typeof total !== 'number' || Number.isNaN(total) || total <= 0) {
      return { label: 'Data Tidak Tersedia', badgeClass: 'bg-slate-200 text-slate-700' }
    }
    const percent = Math.max(0, Math.min(100, Math.round(((typeof active === 'number' ? active : 0) / total) * 100)))
    if (percent >= 80) return { label: `${percent}%`, badgeClass: 'bg-emerald-100 text-emerald-700' }
    if (percent >= 50) return { label: `${percent}%`, badgeClass: 'bg-amber-100 text-amber-700' }
    return { label: `${percent}%`, badgeClass: 'bg-rose-100 text-rose-700' }
  }

  const windVisuals = computeWindVisuals(dashboard?.wind.speed)
  const rainVisuals = computeRainVisuals(dashboard?.rain.intensity)
  const waterBadge = computeWaterBadge(dashboard?.water.status)
  const deviceBadge = computeDeviceBadge(dashboard?.devices.total, dashboard?.devices.active)
  const targetHeightLabel = typeof prediction?.toWaterLevel === 'number' ? `${prediction.toWaterLevel} cm` : 'Tidak diketahui'
  const currentHeightLabel = typeof prediction?.currentLevel === 'number' ? `${prediction.currentLevel} cm` : 'Tidak diketahui'
  const riseLabel = typeof prediction?.riseRate === 'number' ? `${prediction.riseRate.toFixed(2)} cm/menit` : 'Laju tidak diketahui'

  const renderPlaceholder = (label = 'Data Tidak Tersedia', icon = '⧗') => (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 border border-slate-200">
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </span>
  )

  const notificationGroups = notifications.reduce(
    (acc, item) => {
      const key = item.dateISO ?? 'unknown'
      if (!acc.order.includes(key)) acc.order.push(key)
      if (!acc.groups[key]) {
        acc.groups[key] = {
          label: item.dateLabel ?? 'Tanggal tidak diketahui',
          items: [],
        }
      }
      acc.groups[key].items.push(item)
      return acc
    },
    { order: [] as string[], groups: {} as Record<string, { label: string; items: Notification[] }> }
  )

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
      <Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} isMenuOpen={sidebarOpen} />

      <div className="flex flex-1">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
            <header className="flex items-center justify-between flex-wrap gap-3 sm:flex-nowrap sm:gap-3">
              <div className="space-y-1">
                <p className="text-sm sm:text-lg font-semibold text-slate-800 whitespace-nowrap">Ketinggian Air yang Patut Diwaspadai</p>
              </div>
              <div className="items-center gap-1 rounded-full bg-white text-sm sm:text-md font-semibold text-slate-800 whitespace-nowrap px-3 py-1 border border-slate-200">
                {dashboard?.deviceID ? `Perangkat ${dashboard.deviceID}` : 'Data Tidak Tersedia'}
              </div>
            </header>

            {isLoading ? (
              <LoadingSkeleton variant="dashboard" />
            ) : (
              <>
                <section className="grid gap-4 sm:gap-5 lg:gap-6">
                  <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 min-h-65">
                    <div className="relative z-10 p-6 pt-7 flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-2 self-start">
                        <div className="flex items-end gap-3">
                          {typeof dashboard?.water.level === 'number' ? (
                            <>
                              <span className="text-6xl font-black leading-none drop-shadow-[0_8px_24px_rgba(0,0,0,0.2)]">{dashboard.water.level}</span>
                              <span className="text-2xl font-semibold text-slate-700">cm</span>
                            </>
                          ) : (
                            renderPlaceholder('Data Tidak Tersedia', '🌊')
                          )}
                        </div>
                      </div>

                      {waterBadge.label !== '---' && (
                        <div className="flex-1 flex justify-end self-center">
                          <div className={`flex items-center gap-3 px-7 py-3 rounded-full shadow-lg ${waterBadge.badgeClass}`}>
                            <span className="text-lg font-black uppercase tracking-[0.2em] drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
                              {waterBadge.label}
                            </span>
                          </div>
                        </div>
                      )}
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

                    <p className="absolute bottom-3 left-6 z-10 text-xs text-white">
                      Terakhir diperbaharui: {dashboard?.water.updatedAt ? formatUpdatedAt(dashboard.water.updatedAt) : '-'}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-500">Kecepatan Angin</p>
                          <div className="flex items-end gap-2">
                            {typeof dashboard?.wind.speed === 'number' ? (
                              <>
                                <span className="text-4xl font-semibold text-slate-900">{dashboard.wind.speed}</span>
                                <span className="text-base text-slate-500">km/jam</span>
                              </>
                            ) : (
                              <div className='pt-3'>
                                {renderPlaceholder('Data Tidak Tersedia', '🍃')}
                              </div>
                            )}
                          </div>
                        </div>
                        {windVisuals.label !== 'Data Tidak Tersedia' && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${windVisuals.badgeClass}`}>
                            {windVisuals.label}
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-purple-500" style={{ width: windVisuals.barWidth }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Level rendah</span>
                        <span>Level tinggi</span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm text-slate-500">Debit Air Hujan</p>
                          <div className="flex items-end gap-2">
                            {typeof dashboard?.rain.intensity === 'number' ? (
                              <>
                                <span className="text-4xl font-semibold text-slate-900">{dashboard.rain.intensity}</span>
                                <span className="text-base text-slate-500">mm/jam</span>
                              </>
                            ) : (
                              <div className='pt-3'>
                                {renderPlaceholder('Data Tidak Tersedia', '🌧️')}
                              </div>
                            )}
                          </div>
                        </div>
                        {rainVisuals.label !== 'Data Tidak Tersedia' && (
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${rainVisuals.badgeClass}`}>
                            {rainVisuals.label}
                          </span>
                        )}
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-sky-500" style={{ width: rainVisuals.barWidth }} />
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Level rendah</span>
                        <span>Level tinggi</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-7">
                          <p className="text-sm text-slate-500">Jumlah Alat Aktif</p>
                          <div className="flex items-end gap-2">
                            {typeof dashboard?.devices.active === 'number' && typeof dashboard?.devices.total === 'number' ? (
                              <>
                                <span className="text-4xl font-semibold text-slate-900">{dashboard.devices.active}</span>
                                <span className="text-base text-slate-500">/ {dashboard.devices.total}</span>
                              </>
                            ) : (
                              renderPlaceholder('Data Perangkat Tidak Tersedia', '🔌')
                            )}
                          </div>
                          <p className="text-xs text-slate-500">Unit Sensor</p>

                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${deviceBadge.badgeClass}`}>
                          {deviceBadge.label}
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-800">Notifikasi Terkini</p>
                        <span className="h-8 w-8 rounded-full bg-slate-900 text-white grid place-items-center text-sm font-semibold">
                          {notifications.length}
                        </span>
                      </div>

                      <div className={`space-y-3 ${shouldScrollNotifications ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
                        {notifications.length === 0 ? (
                          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Data Tidak Tersedia
                          </div>
                        ) : (
                          notificationGroups.order.map((groupKey) => {
                            const group = notificationGroups.groups[groupKey]
                            return (
                              <div key={`notif-group-${groupKey}`} className="space-y-2">
                                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                  <span className="h-px flex-1 bg-slate-200" />
                                  <span>{group.label}</span>
                                  <span className="h-px flex-1 bg-slate-200" />
                                </div>
                                {group.items.map((item, index) => (
                                  <div
                                    key={`${item.title ?? 'notif'}-${groupKey}-${index}`}
                                    className={`rounded-xl border px-4 py-3 shadow-sm flex items-start justify-between gap-3 ${item.status === 'normal'
                                      ? 'border-emerald-200 bg-emerald-50/70'
                                      : 'border-orange-200 bg-orange-50/80'
                                      }`}
                                  >
                                    <div className="space-y-1">
                                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                                      <p className="text-xs text-slate-600">{item.description}</p>
                                    </div>
                                    <span
                                      className={`text-[11px] font-semibold px-2 py-1 rounded-full whitespace-nowrap ${item.status === 'normal'
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-orange-100 text-orange-700'
                                        }`}
                                    >
                                      {item.time ?? 'Data Tidak Tersedia'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </section>

                {shouldShowPredictionCard && prediction && (
                  <section className="grid">
                    <div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-sm border border-slate-200">
                      <div className="absolute inset-0 bg-linear-to-r from-rose-50 via-white to-slate-50" aria-hidden />
                      <div className="relative p-5 sm:p-6 flex flex-col gap-5 sm:gap-6">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 grid place-items-center text-lg font-semibold">🔥</span>
                            <div>
                              <p className="text-sm font-semibold text-slate-800">Prediksi Ketinggian Air</p>
                              <p className="text-xs text-slate-500">Perangkat {dashboard?.deviceID ?? 'Data Tidak Tersedia'}</p>
                            </div>
                          </div>
                          {(() => {
                            const statusLabel = prediction.toStatus || 'Data Tidak Tersedia'
                            const lower = statusLabel.toLowerCase()
                            const badgeClass = lower.includes('bahaya')
                              ? 'bg-rose-100 text-rose-700'
                              : lower.includes('siaga')
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            return (
                              <span className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${badgeClass}`}>
                                {statusLabel}
                              </span>
                            )
                          })()}
                        </div>

                        <div className="flex items-end gap-4 sm:gap-5">
                          <div className="leading-none">
                            {typeof prediction.toWaterLevel === 'number' ? (
                              <span className="text-6xl sm:text-7xl font-black text-slate-900 drop-shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
                                {prediction.toWaterLevel}
                              </span>
                            ) : (
                              <div className="pt-2">{renderPlaceholder('Data Tidak Tersedia', '⧗')}</div>
                            )}
                          </div>
                          <span className="text-2xl sm:text-3xl font-semibold text-slate-700 pb-2">cm</span>
                        </div>

                        <p className="text-xs sm:text-sm text-slate-600">
                          {`Perkiraan tinggi air akan naik dari status ${prediction.fromStatus} (${currentHeightLabel}) ke ${prediction.toStatus} (${targetHeightLabel}) dalam waktu ${formatEta(prediction.estimatedMinutes)}, dengan laju ${riseLabel}.`}
                        </p>
                      </div>
                    </div>
                  </section>
                )}
              </>
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

export default App
