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
	prediction?: BackendPrediction | null
	imageUrl?: string
}

type MonitoringResponse = {
	success: boolean
	stats: { totalDevices: number; activeDevices: number }
	devices: MonitoringDeviceAPI[]
}

type DeviceMetric = {
	label: string
	value: number | null
	unit: string
	statusLabel: string
	scaleFill: number
	kind: 'wind' | 'rain'
	trend: string
	detail: string
}

type Device = {
	id: string
	name: string
	heroLabel: string
	heroValue: number | null
	heroUnit: string
	statusLabel: string
	updatedAt: string
	waterStatus: string
	windStatus: string
	rainStatus: string
	metrics: DeviceMetric[]
	cameraTime: string
	location: string
	lat?: number
	lon?: number
	cameraImage: string
}

type BackendPrediction = {
	fromStatus?: string
	toStatus?: string
	waterLevel?: number
	toWaterLevel?: number
	estimatedMinutes?: number
	adjustedRiseRate?: number | string
}

type PredictionState = {
	deviceID: string
	fromStatus: string
	toStatus: string
	toWaterLevel: number | null
	estimatedMinutes: number
	currentLevel: number | null
	riseRate: number | null
}

const PREDICTION_MAX_MINUTES = 120

const computeWaterBadge = (status?: string) => {
	const label = status ? status.toUpperCase() : '---'
	const lower = (status || '').toLowerCase().trim()
	const isMissing = !lower || lower === 'data tidak tersedia' || lower === 'tidak ada data' || lower === 'n/a' || lower === 'unknown'
	if (isMissing) return { label: '---', badgeClass: 'bg-slate-200 text-slate-700 border border-slate-300 shadow-sm' }
	if (lower.includes('bahaya') || lower.includes('danger')) {
		return { label, badgeClass: 'bg-linear-to-r from-red-500 to-orange-500 text-white border border-orange-100 shadow-orange-600/40' }
	}
	if (lower.includes('siaga') || lower.includes('warning') || lower.includes('waspada')) {
		return { label, badgeClass: 'bg-linear-to-r from-amber-400 to-orange-500 text-white border border-amber-100 shadow-amber-500/40' }
	}
	return { label, badgeClass: 'bg-linear-to-r from-emerald-500 to-teal-500 text-white border border-emerald-100 shadow-emerald-600/30' }
}

const computeWindVisuals = (speed?: number) => {
	if (typeof speed !== 'number' || Number.isNaN(speed)) {
		return { label: 'Data Tidak Tersedia', badgeClass: 'bg-slate-200 text-slate-500', barWidth: 0 }
	}
	if (speed <= 0) return { label: 'Tidak ada angin', badgeClass: 'bg-slate-200 text-slate-600', barWidth: 0 }
	if (speed < 10) return { label: 'Tenang', badgeClass: 'bg-emerald-100 text-emerald-700', barWidth: 25 }
	if (speed < 20) return { label: 'Sedang', badgeClass: 'bg-amber-100 text-amber-700', barWidth: 55 }
	return { label: 'Kencang', badgeClass: 'bg-rose-100 text-rose-700', barWidth: 85 }
}

const computeRainVisuals = (intensity?: number) => {
	if (typeof intensity !== 'number' || Number.isNaN(intensity)) {
		return { label: 'Data Tidak Tersedia', badgeClass: 'bg-slate-200 text-slate-500', barWidth: 0 }
	}
	if (intensity <= 0) return { label: 'Tidak ada hujan', badgeClass: 'bg-slate-200 text-slate-600', barWidth: 0 }
	if (intensity < 2) return { label: 'Gerimis', badgeClass: 'bg-emerald-100 text-emerald-700', barWidth: 30 }
	if (intensity < 10) return { label: 'Sedang', badgeClass: 'bg-amber-100 text-amber-700', barWidth: 60 }
	return { label: 'Lebat', badgeClass: 'bg-rose-100 text-rose-700', barWidth: 90 }
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

const formatLocation = (location: LocationValue): { location: string; lat?: number; lon?: number } => {
	if (typeof location === 'string' && location.trim().length) {
		return { location }
	}
	if (location && typeof location === 'object') {
		const lat = location.latitude
		const lon = location.longitude
		const hasCoords = typeof lat === 'number' && typeof lon === 'number'
		return {
			location: hasCoords ? `Lat: ${lat}, Lon: ${lon}` : 'Lokasi tidak diketahui',
			lat: hasCoords ? lat : undefined,
			lon: hasCoords ? lon : undefined,
		}
	}
	return { location: 'Lokasi tidak diketahui' }
}

const mapMonitoringDevices = (payload: MonitoringDeviceAPI[]): Device[] => {
	return payload.map((device) => {
		const waterStatus = device.water.status || 'Data Tidak Tersedia'
		const windVisual = computeWindVisuals(device.wind.speed)
		const rainVisual = computeRainVisuals(device.rain.intensity)
		const updatedAt = device.water.updatedAt || device.lastActive
		const { location, lat, lon } = formatLocation(device.location)
		return {
			id: device.deviceID || 'unknown-device',
			name: device.deviceID || 'Perangkat',
			heroLabel: 'Ketinggian Air Sungai',
			heroValue: typeof device.water.level === 'number' ? device.water.level : null,
			heroUnit: 'cm',
			statusLabel: waterStatus,
			updatedAt: formatTime(updatedAt),
			waterStatus,
			windStatus: windVisual.label,
			rainStatus: rainVisual.label,
			metrics: [
				{
					label: 'Kecepatan Angin',
					value: typeof device.wind.speed === 'number' ? device.wind.speed : null,
					unit: 'km/jam',
					statusLabel: windVisual.label,
					scaleFill: windVisual.barWidth,
					kind: 'wind',
					trend: '',
					detail: `Terakhir aktif ${formatAgo(device.lastActive)}`,
				},
				{
					label: 'Debit Air Hujan',
					value: typeof device.rain.intensity === 'number' ? device.rain.intensity : null,
					unit: 'mm/jam',
					statusLabel: rainVisual.label,
					scaleFill: rainVisual.barWidth,
					kind: 'rain',
					trend: '',
					detail: `Diperbarui ${formatAgo(device.water.updatedAt)}`,
				},
			],
			cameraTime: formatTime(device.lastActive),
			location,
			lat,
			lon,
			cameraImage: device.imageUrl ?? '',
		}
	})
}

const normalizePrediction = (deviceID: string, pred?: BackendPrediction | null): PredictionState | null => {
	if (!pred) return null
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
	}
}

export default function Pemantauan() {
	const [devices, setDevices] = useState<Device[]>([])
	const [activeDeviceId, setActiveDeviceId] = useState<string>()
	const [isLoading, setIsLoading] = useState(false)
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [predictionMap, setPredictionMap] = useState<Record<string, PredictionState>>({})
	const shouldShowActivePrediction = Boolean(predictionMap[activeDeviceId || ''] && predictionMap[activeDeviceId || ''].estimatedMinutes <= PREDICTION_MAX_MINUTES)

	useEffect(() => {
		let isMounted = true

		const fetchMonitoring = async () => {
			setIsLoading(true)
			try {
				const res = await axios.get<MonitoringResponse>(import.meta.env.VITE_MONITORING_API_URL)
				if (!isMounted) return
				const payload = res.data?.devices || []
				const mapped = mapMonitoringDevices(payload)
				setDevices(mapped)
				setActiveDeviceId((current) => (mapped.some((item) => item.id === current) ? current : mapped[0]?.id))

				const initialPredictions = payload.reduce<Record<string, PredictionState>>((acc, device) => {
					const normalized = normalizePrediction(device.deviceID, device.prediction)
					if (normalized) acc[device.deviceID] = normalized
					return acc
				}, {})
				setPredictionMap(initialPredictions)
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

	const formatEta = (minutes?: number) => {
		if (minutes === undefined || minutes === null || Number.isNaN(minutes)) return '(Perkiraan waktu tidak tersedia)'
		if (minutes < 1) return 'kurang dari 1 menit'
		if (minutes < 60) return `${minutes} menit lagi`
		const hours = Math.floor(minutes / 60)
		const mins = minutes % 60
		if (hours >= 24) return `${Math.floor(hours / 24)} hari ${hours % 24} jam lagi`
		return mins ? `${hours} jam ${mins} menit lagi` : `${hours} jam lagi`
	}

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

		const handlePrediction = (payload: any) => {
			const pred = payload?.prediction
			const deviceID = payload?.deviceID
			if (!deviceID) return
			const normalized = normalizePrediction(deviceID, pred)
			if (!normalized) {
				setPredictionMap((prev) => {
					const next = { ...prev }
					delete next[deviceID]
					return next
				})
				return
			}

			setPredictionMap((prev) => ({
				...prev,
				[deviceID]: normalized,
			}))
		}

		const handleNewImage = (payload: any) => {
			const { deviceID, imageUrl } = payload || {}
			if (!deviceID || !imageUrl) return
			setDevices((prev) => prev.map((d) => (d.id === deviceID ? { ...d, cameraImage: imageUrl } : d)))
		}

		const deviceIds = devices.map((d) => d.id).filter(Boolean)
		deviceIds.forEach((id) => socket.emit('join_device', id))

		socket.on('sensor_data_update', handleSensorUpdate)
		socket.on('water_level_prediction', handlePrediction)
		socket.on('new_image', handleNewImage)

		return () => {
			socket.off('sensor_data_update', handleSensorUpdate)
			socket.off('water_level_prediction', handlePrediction)
			socket.off('new_image', handleNewImage)
			deviceIds.forEach((id) => socket.emit('leave_device', id))
		}
	}, [devices])

	const activePrediction = activeDeviceId ? predictionMap[activeDeviceId] : undefined
	const targetHeightLabel = typeof activePrediction?.toWaterLevel === 'number' ? `${activePrediction.toWaterLevel} cm` : 'Tidak diketahui'
	const currentHeightLabel = typeof activePrediction?.currentLevel === 'number' ? `${activePrediction.currentLevel} cm` : 'Tidak diketahui'
	const riseLabel = typeof activePrediction?.riseRate === 'number' ? `${activePrediction.riseRate.toFixed(2)} cm/menit` : 'Laju tidak diketahui'
	const waterBadge = computeWaterBadge(activeDevice?.waterStatus)

	const renderPlaceholder = (label = 'Data Tidak Tersedia', icon = '⧗') => (
		<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold px-3 py-1 border border-slate-200">
			<span aria-hidden>{icon}</span>
			<span>{label}</span>
		</span>
	)


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
							<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 text-sm text-slate-600 flex items-center gap-2">
								<span aria-hidden>🔍</span>
								<span>Data perangkat belum tersedia</span>
							</div>
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
													className={`group relative overflow-hidden rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold border border-b-0 transition flex items-center gap-2 ${isActive
														? 'text-white border-sky-300 shadow-lg shadow-sky-200/60'
														: 'text-slate-500 border-slate-200 hover:text-slate-700 hover:shadow-sm'
														}`}
													style={isActive ? { background: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 60%, #0ea5e9 100%)', boxShadow: '0 12px 36px rgba(14,165,233,0.35)' } : undefined}
												>
													<span className={`h-2 w-2 rounded-full transition ${isActive ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
													<span className="relative z-10">{device.name}</span>
													<span
														className={`text-[10px] uppercase tracking-[0.16em] font-black transition ${isActive ? 'text-white/90' : 'text-slate-400 group-hover:text-slate-500'
															}`}
													>
													</span>
													<span
														className={`absolute inset-0 bg-linear-to-r from-white/10 via-white/20 to-white/10 opacity-0 group-hover:opacity-100 transition ${isActive ? 'opacity-100' : ''
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
													{typeof activeDevice.heroValue === 'number' ? (
														<>
															<span className="text-3xl sm:text-5xl font-black leading-none drop-shadow-[0_6px_18px_rgba(0,0,0,0.2)]">{activeDevice.heroValue}</span>
															<span className="text-base sm:text-xl font-semibold text-slate-700">{activeDevice.heroUnit}</span>
														</>
													) : (
														<div className='pt-2'>
															{renderPlaceholder('Data Tidak Tersedia', '🌊')}
														</div>
													)}
												</div>
											</div>

											{waterBadge.label !== '---' && (
												<div className="flex-1 flex justify-end self-center">
													<div className={`flex items-center gap-3 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full shadow-lg ${waterBadge.badgeClass}`}>
														<span className="text-sm sm:text-base font-black uppercase tracking-[0.18em] drop-shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
															{waterBadge.label}
														</span>
													</div>
												</div>
											)}
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
										{activeDevice.metrics.map((metric) => {
											const visuals = metric.kind === 'wind' ? computeWindVisuals(metric.value ?? undefined) : computeRainVisuals(metric.value ?? undefined)
											const barColor = metric.kind === 'wind' ? 'bg-purple-500' : 'bg-sky-500'
											return (
												<div key={metric.label} className="rounded-2xl bg-white shadow-sm border border-slate-200 p-4 sm:p-5 flex flex-col gap-4">
													<div className="flex items-start justify-between">
														<div>
															<p className="text-sm text-slate-500">{metric.label}</p>
															<div className="flex items-end gap-2">
																{typeof metric.value === 'number' ? (
																	<>
																		<span className="text-4xl font-semibold text-slate-900">{metric.value}</span>
																		<span className="text-base text-slate-500">{metric.unit}</span>
																	</>
																) : (
																	<div className='pt-3'>
																		{renderPlaceholder('Data Tidak Tersedia', metric.kind === 'wind' ? '🍃' : '🌧️')}
																	</div>
																)}
															</div>
														</div>
														{visuals.label !== 'Data Tidak Tersedia' && (
															<span className={`px-3 py-1 rounded-full text-xs font-semibold ${visuals.badgeClass}`}>
																{visuals.label}
															</span>
														)}
													</div>
													<div className="h-1.5 rounded-full bg-slate-100">
														<div className={`h-full rounded-full ${barColor}`} style={{ width: `${visuals.barWidth}%` }} />
													</div>
													<div className="flex justify-between text-xs text-slate-500">
														<span>Level rendah</span>
														<span>Level tinggi</span>
													</div>
													<div className="flex items-center gap-4 text-xs text-slate-500" />
												</div>
											)
										})}
									</div>

									<div className="grid gap-4 sm:gap-5 lg:gap-6 xl:grid-cols-3">
										<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
											<div className="flex items-center justify-between px-4 py-3 bg-sky-500 text-white text-sm font-semibold">
												<div className="flex items-center gap-2">
													<span>Live Camera Feed</span>
												</div>
											</div>
											<div className="bg-slate-100 overflow-hidden relative w-full" style={{ aspectRatio: '16 / 9', maxHeight: '360px' }}>
												{activeDevice.cameraImage ? (
													<img src={activeDevice.cameraImage} alt="Live camera feed" className="absolute inset-0 h-full w-full object-cover" />
												) : (
													<div className="absolute inset-0 grid place-items-center text-xs text-slate-500">Tidak ada gambar</div>
												)}
											</div>
										</div>

										<div className="xl:col-span-2 rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden flex flex-col">
											<div className="flex items-center justify-between px-4 py-3 bg-emerald-500 text-white text-sm font-semibold">
												<div className="flex items-center gap-2">
													<span>Lokasi Sensor</span>
												</div>
											</div>
											<div className="flex-1 h-56 bg-slate-100 overflow-hidden">
												{typeof activeDevice.lat === 'number' && typeof activeDevice.lon === 'number' ? (
													<iframe
														title={`Lokasi ${activeDevice.name}`}
														src={`https://www.google.com/maps?q=${activeDevice.lat},${activeDevice.lon}&z=14&output=embed`}
														className="h-full w-full border-0"
														loading="lazy"
														allowFullScreen
													/>
												) : (
													<div className="h-full w-full grid place-items-center text-sm text-slate-500">Lokasi tidak diketahui</div>
												)}
											</div>
											<div className="px-4 py-3 text-xs text-slate-600 flex gap-2">
												<p>Latitude: {activeDevice.lat}</p>
												<p>Longitude: {activeDevice.lon}</p>
											</div>
										</div>
									</div>

									{shouldShowActivePrediction && activePrediction && (
										<div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
											<div className="relative overflow-hidden">
												<div className="absolute inset-0 bg-linear-to-r from-rose-50 via-white to-slate-50" aria-hidden />
												<div className="relative p-5 sm:p-6 flex flex-col gap-5 sm:gap-6">
													<div className="flex items-center justify-between gap-3 flex-wrap">
														<div className="flex items-center gap-3">
															<span className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 grid place-items-center text-lg font-semibold">🔥</span>
															<div>
																<p className="text-sm font-semibold text-slate-800">Prediksi Ketinggian Air</p>
																<p className="text-xs text-slate-500">Perangkat {activeDevice?.name ?? 'Data Tidak Tersedia'}</p>
															</div>
														</div>
														<span
															className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide ${(activePrediction?.toStatus || '').toLowerCase().includes('bahaya')
																? 'bg-rose-100 text-rose-700'
																: (activePrediction?.toStatus || '').toLowerCase().includes('siaga')
																	? 'bg-amber-100 text-amber-700'
																	: 'bg-emerald-100 text-emerald-700'
																}`}
														>
															{activePrediction.toStatus || 'Data Tidak Tersedia'}
														</span>
													</div>

													<div className="flex items-end gap-4 sm:gap-5">
														<div className="leading-none">
															{typeof activePrediction.toWaterLevel === 'number' ? (
																<span className="text-6xl sm:text-7xl font-black text-slate-900 drop-shadow-[0_10px_28px_rgba(0,0,0,0.18)]">
																	{activePrediction.toWaterLevel}
																</span>
															) : (
																<div className="pt-2">{renderPlaceholder('Data Tidak Tersedia', '⧗')}</div>
															)}
														</div>
														<span className="text-2xl sm:text-3xl font-semibold text-slate-700 pb-2">cm</span>
													</div>

													<p className="text-xs sm:text-sm text-slate-600">
														{`Perkiraan tinggi air akan naik dari status ${activePrediction.fromStatus} (${currentHeightLabel}) ke ${activePrediction.toStatus} (${targetHeightLabel}) dalam waktu ${formatEta(activePrediction.estimatedMinutes)}, dengan laju ${riseLabel}.`}
													</p>
												</div>
											</div>
										</div>
									)}
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
