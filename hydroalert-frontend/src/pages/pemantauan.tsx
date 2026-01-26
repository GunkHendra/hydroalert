import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'
import { connectSocket } from '../lib/socket'
import { LoadingSkeleton } from '../components/LoadingSkeleton'

type LocationValue =
	| string
	| {
			latitude?: number
			longitude?: number
		}
	| undefined

type MonitoringDeviceAPI = {
	deviceID: string
	location: LocationValue
	lastActive: string
	water: { level: number; status: string; updatedAt: string }
	wind: { speed: number }
	rain: { intensity: number }
	imageUrl?: string
}

type MonitoringResponse = {
	success: boolean
	stats: { totalDevices: number; activeDevices: number }
	devices: MonitoringDeviceAPI[]
}

type DeviceMetric = {
	label: string
	value: number
	unit: string
	status: 'Normal' | 'Warning'
	scaleFill: number
	trend: string
	detail: string
}

type Device = {
	id: string
	name: string
	heroLabel: string
	heroValue: number
	heroUnit: string
	status: 'Normal' | 'Warning'
	updatedAt: string
	metrics: DeviceMetric[]
	cameraTime: string
	location: string
	coordinates: string
	cameraImage: string
}

const normalizeStatus = (status?: string): Device['status'] => {
	const normalized = (status || '').toLowerCase()
	if (normalized === 'warning' || normalized === 'bahaya' || normalized === 'waspada') return 'Warning'
	return 'Normal'
}

const formatTime = (iso?: string) => {
	if (!iso) return '-'
	const date = new Date(iso)
	return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const formatAgo = (iso?: string) => {
	if (!iso) return '-'
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

const scaleFill = (value: number, max = 100) => Math.min(100, Math.round(((value || 0) / max) * 100))

const formatLocation = (location: LocationValue): { location: string; coordinates: string } => {
	if (typeof location === 'string' && location.trim().length) {
		return { location, coordinates: '-' }
	}
	if (location && typeof location === 'object') {
		const lat = location.latitude ?? null
		const lon = location.longitude ?? null
		const hasCoords = lat !== null && lon !== null
		return {
			location: hasCoords ? `Lat: ${lat}, Lon: ${lon}` : 'Lokasi tidak diketahui',
			coordinates: hasCoords ? `${lat}, ${lon}` : '-',
		}
	}
	return { location: 'Lokasi tidak diketahui', coordinates: '-' }
}

const mapMonitoringDevices = (payload: MonitoringDeviceAPI[]): Device[] => {
	return payload.map((device) => {
		const status = normalizeStatus(device.water.status)
		const updatedAt = device.water.updatedAt || device.lastActive
		const { location, coordinates } = formatLocation(device.location)
		return {
			id: device.deviceID || 'unknown-device',
			name: device.deviceID || 'Perangkat',
			heroLabel: 'Ketinggian Air Sungai',
			heroValue: device.water.level ?? 0,
			heroUnit: 'cm',
			status,
			updatedAt: formatTime(updatedAt),
			metrics: [
				{
					label: 'Kecepatan Angin',
					value: device.wind.speed ?? 0,
					unit: 'km/jam',
					status,
					scaleFill: scaleFill(device.wind.speed ?? 0, 60),
					trend: '',
					detail: `Terakhir aktif ${formatAgo(device.lastActive)}`,
				},
				{
					label: 'Debit Air Hujan',
					value: device.rain.intensity ?? 0,
					unit: 'mm/jam',
					status,
					scaleFill: scaleFill(device.rain.intensity ?? 0, 80),
					trend: '',
					detail: `Diperbarui ${formatAgo(device.water.updatedAt)}`,
				},
			],
			cameraTime: formatTime(device.lastActive),
			location,
			coordinates,
			cameraImage: device.imageUrl ?? '',
		}
	})
}

export default function Pemantauan() {
	const [devices, setDevices] = useState<Device[]>([])
	const [activeDeviceId, setActiveDeviceId] = useState<string>()
	const [isLoading, setIsLoading] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState(false)

	useEffect(() => {
		let isMounted = true

		const fetchMonitoring = async () => {
			setIsLoading(true)
			try {
				const res = await axios.get<MonitoringResponse>('http://localhost:3000/api/monitoring')
				if (!isMounted) return
				const mapped = mapMonitoringDevices(res.data?.devices || [])
				setDevices(mapped)
				setActiveDeviceId((current) => (mapped.some((item) => item.id === current) ? current : mapped[0]?.id))
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

	const activeDevice = useMemo(() => {
		if (!devices.length) return undefined
		return devices.find((device) => device.id === activeDeviceId) ?? devices[0]
	}, [activeDeviceId, devices])

	useEffect(() => {
		const socket = connectSocket()

		const handleSensorUpdate = (payload: MonitoringDeviceAPI) => {
			const mapped = mapMonitoringDevices([payload])[0]
			setDevices((prev) => {
				const idx = prev.findIndex((d) => d.id === mapped.id)
				if (idx === -1) return [...prev, mapped]
				const next = [...prev]
				next[idx] = { ...prev[idx], ...mapped, metrics: mapped.metrics, cameraImage: mapped.cameraImage || prev[idx].cameraImage }
				return next
			})
		}

		const handlePrediction = (_payload: any) => {
			// Placeholder: integrate prediction UI if needed
		}

		const handleNewImage = (payload: any) => {
			const { deviceID, imageUrl } = payload || {}
			if (!deviceID || !imageUrl) return
			setDevices((prev) => prev.map((d) => (d.id === deviceID ? { ...d, cameraImage: imageUrl } : d)))
		}

		if (activeDeviceId) {
			socket.emit('join_device', activeDeviceId)
		}

		socket.on('sensor_data_update', handleSensorUpdate)
		socket.on('water_level_prediction', handlePrediction)
		socket.on('new_image', handleNewImage)

		return () => {
			socket.off('sensor_data_update', handleSensorUpdate)
			socket.off('water_level_prediction', handlePrediction)
			socket.off('new_image', handleNewImage)
			if (activeDeviceId) {
				socket.emit('leave_device', activeDeviceId)
			}
		}
	}, [activeDeviceId])

	return (
		<div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
			<Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} isMenuOpen={sidebarOpen} />

			<div className="flex flex-1">
				<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

				<div className="flex-1 flex flex-col">
					<main className="flex-1 p-4 sm:p-6 lg:p-8">
						{isLoading ? (
							<LoadingSkeleton variant="monitoring" />
						) : !activeDevice ? (
							<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-sm text-slate-600">Data tidak ada</div>
						) : (
							<>
								<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">
									<div className="flex flex-wrap items-center gap-2 sm:gap-3">
										{devices.map((device) => {
											const isActive = device.id === activeDevice.id

											return (
												<button
													key={device.id}
													onClick={() => setActiveDeviceId(device.id)}
													aria-pressed={isActive}
													className={`group relative overflow-hidden rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold border border-b-0 transition flex items-center gap-2 ${
														isActive
															? 'text-white border-sky-300 shadow-lg shadow-sky-200/60'
															: 'text-slate-500 border-slate-200 hover:text-slate-700 hover:shadow-sm'
													}`}
													style={isActive ? { background: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 60%, #0ea5e9 100%)', boxShadow: '0 12px 36px rgba(14,165,233,0.35)' } : undefined}
												>
													<span className={`h-2 w-2 rounded-full transition ${isActive ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
													<span className="relative z-10">{device.name}</span>
													<span
														className={`text-[10px] uppercase tracking-[0.16em] font-black transition ${
															isActive ? 'text-white/90' : 'text-slate-400 group-hover:text-slate-500'
														}`}
													>
													</span>
													<span
														className={`absolute inset-0 bg-linear-to-r from-white/10 via-white/20 to-white/10 opacity-0 group-hover:opacity-100 transition ${
															isActive ? 'opacity-100' : ''
														}`}
														aria-hidden
													/>
												</button>
											)
										})}
								</div>

								<div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 min-h-55">
									<div className="relative z-10 p-4 sm:p-6 pt-7 flex flex-wrap items-start justify-between gap-4">
										<div className="space-y-2">
											<p className="text-sm font-semibold text-slate-800">{activeDevice.heroLabel}</p>
											<div className="flex items-end gap-3">
												<span className="text-3xl sm:text-5xl font-black leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.2)]">{activeDevice.heroValue}</span>
												<span className="text-base sm:text-xl font-semibold text-slate-700">{activeDevice.heroUnit}</span>
											</div>
										</div>

										<div className="flex-1 flex justify-end self-center">
											<div
												className={`flex items-center gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg border ${
													activeDevice.status === 'Normal'
														? 'bg-linear-to-r from-emerald-500 to-green-600 shadow-emerald-600/30 border-emerald-100'
														: 'bg-linear-to-r from-amber-400 to-orange-500 shadow-amber-500/30 border-amber-100'
												}`}
											>
												<span className="text-sm sm:text-base font-black uppercase tracking-[0.18em] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.2)]">
													{activeDevice.status}
												</span>
											</div>
										</div>
									</div>

									<div className="absolute inset-0">
										<svg viewBox="0 0 600 200" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-40 w-full" aria-hidden>
											<path d="M0 60 C150 110 250 30 400 90 C500 130 550 90 600 110 V200 H0 Z" fill="#38bdf8" />
											<path d="M0 100 C130 70 230 140 370 80 C490 40 540 130 600 100 V200 H0 Z" fill="#0ea5e9" />
										</svg>
									</div>

									<p className="absolute bottom-3 left-6 z-10 text-xs text-white">Terakhir diperbaharui: {activeDevice.updatedAt}</p>
								</div>

								<div className="grid gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
									{activeDevice.metrics.map((metric) => (
										<div key={metric.label} className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
											<div className="flex items-start justify-between">
												<div>
													<p className="text-sm text-slate-500">{metric.label}</p>
													<div className="flex items-end gap-2">
														<span className="text-4xl font-semibold text-slate-900">{metric.value}</span>
														<span className="text-base text-slate-500">{metric.unit}</span>
													</div>
												</div>
												<span
													className={`px-3 py-1 rounded-full text-xs font-semibold ${
														metric.status === 'Normal' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
													}`}
												>
													{metric.status}
												</span>
											</div>
											<div className="h-1.5 rounded-full bg-slate-100">
												<div
													className={`h-full rounded-full ${metric.status === 'Normal' ? 'bg-sky-500' : 'bg-amber-500'}`}
													style={{ width: `${metric.scaleFill}%` }}
												/>
											</div>
											<div className="flex justify-between text-xs text-slate-500">
												<span>Level rendah</span>
												<span>Level tinggi</span>
											</div>
											<div className="flex items-center gap-4 text-xs text-slate-500">
											</div>
										</div>
									))}
								</div>

								<div className="grid gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-3">
									<div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
										<div className="flex items-center justify-between px-4 py-3 bg-sky-500 text-white text-sm font-semibold">
											<div className="flex items-center gap-2">
												<span className="h-5 w-5 rounded-full bg-white/20 grid place-items-center text-[10px] text-slate-900 font-bold">CAM</span>
												<span>Live Camera Feed</span>
											</div>
											<span className="text-xs font-semibold text-red-100">LIVE</span>
										</div>
										<div className="h-64 bg-slate-100 overflow-hidden">
											<img src={activeDevice.cameraImage} alt="Live camera feed" className="h-full w-full object-cover" />
										</div>
										<div className="px-4 py-3 text-xs text-slate-600 flex items-center justify-between">
											<span>
												{activeDevice.name} - {activeDevice.location}
											</span>
											<span className="text-slate-500">{activeDevice.cameraTime}</span>
										</div>
									</div>

									<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col">
										<div className="flex items-center justify-between px-4 py-3 bg-emerald-500 text-white text-sm font-semibold">
											<div className="flex items-center gap-2">
												<span className="h-5 w-5 rounded-full bg-white/20 grid place-items-center text-[10px] text-slate-900 font-bold">MAP</span>
												<span>Lokasi Sensor</span>
											</div>
											<span className="text-xs text-white/80">{activeDevice.name}</span>
										</div>
										<div className="flex-1 h-56 bg-slate-100 grid place-items-center text-sm text-slate-500">Peta disematkan di sini</div>
										<div className="px-4 py-3 text-xs text-slate-600 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
											<p>{activeDevice.location}</p>
											<p className="text-slate-500">Koordinat: {activeDevice.coordinates}</p>
										</div>
									</div>
								</div>
							</div>
						</>
					)}
				</main>

				<footer className="border-t border-slate-200 bg-white/80 backdrop-blur supports-backdrop-filter:bg-white/60 px-4 sm:px-8 py-4 text-sm text-slate-500 flex items-center justify-end gap-6">
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
