import { useMemo, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'

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

type Notification = {
	title: string
	description: string
	status: 'normal' | 'warning'
	time: string
}

const devices: Device[] = [
	{
		id: 'device-a',
		name: 'Device A',
		heroLabel: 'Ketinggian Air Sungai',
		heroValue: 120,
		heroUnit: 'cm',
		status: 'Normal',
		updatedAt: '10.00',
		metrics: [
			{
				label: 'Kecepatan Angin',
				value: 15,
				unit: 'km/jam',
				status: 'Normal',
				scaleFill: 40,
				trend: 'Naik +2 km/jam',
				detail: 'Arah Timur Laut',
			},
			{
				label: 'Debit Air Hujan',
				value: 18,
				unit: 'mm/jam',
				status: 'Normal',
				scaleFill: 50,
				trend: 'Naik +5 mm/jam',
				detail: 'Durasi 2 jam',
			},
		],
		cameraTime: '15.33.43',
		location: 'Sungai Pengakan, Bali',
		coordinates: '-8.3726, 115.1923',
		cameraImage: 'https://images.unsplash.com/photo-1505760427687-7fdb6f0a68c4?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'device-b',
		name: 'Device B',
		heroLabel: 'Ketinggian Air Sungai',
		heroValue: 95,
		heroUnit: 'cm',
		status: 'Normal',
		updatedAt: '09.50',
		metrics: [
			{
				label: 'Kecepatan Angin',
				value: 9,
				unit: 'km/jam',
				status: 'Normal',
				scaleFill: 25,
				trend: 'Stabil',
				detail: 'Arah Selatan',
			},
			{
				label: 'Debit Air Hujan',
				value: 10,
				unit: 'mm/jam',
				status: 'Normal',
				scaleFill: 35,
				trend: 'Turun -1 mm/jam',
				detail: 'Durasi 1 jam',
			},
		],
		cameraTime: '15.28.10',
		location: 'Sungai Wos, Bali',
		coordinates: '-8.5095, 115.2651',
		cameraImage: 'https://images.unsplash.com/photo-1505761671935-60b3a7427bad?auto=format&fit=crop&w=900&q=80',
	},
	{
		id: 'device-c',
		name: 'Device C',
		heroLabel: 'Ketinggian Air Sungai',
		heroValue: 132,
		heroUnit: 'cm',
		status: 'Warning',
		updatedAt: '10.05',
		metrics: [
			{
				label: 'Kecepatan Angin',
				value: 22,
				unit: 'km/jam',
				status: 'Warning',
				scaleFill: 70,
				trend: 'Naik +6 km/jam',
				detail: 'Arah Barat Daya',
			},
			{
				label: 'Debit Air Hujan',
				value: 30,
				unit: 'mm/jam',
				status: 'Warning',
				scaleFill: 75,
				trend: 'Naik +8 mm/jam',
				detail: 'Durasi 3 jam',
			},
		],
		cameraTime: '15.40.12',
		location: 'Sungai Ayung, Bali',
		coordinates: '-8.5480, 115.2625',
		cameraImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
	},
]

const notifications: Notification[] = [
	{
		title: 'Kecepatan angin normal',
		description: 'Laju angin dalam batas aman',
		status: 'normal',
		time: '5 menit lalu',
	},
	{
		title: 'Debit air naik',
		description: 'Perlu pantau area sekitar perangkat C',
		status: 'warning',
		time: '10 menit lalu',
	},
]

export default function Pemantauan() {
	const [activeDeviceId, setActiveDeviceId] = useState<string>(devices[0].id)
	const [sidebarOpen, setSidebarOpen] = useState(false)

	const activeDevice = useMemo(() => devices.find((device) => device.id === activeDeviceId) ?? devices[0], [activeDeviceId])

	return (
		<div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
			<Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} isMenuOpen={sidebarOpen} />

			<div className="flex flex-1">
				<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

				<div className="flex-1 flex flex-col">
					<main className="flex-1 p-4 sm:p-6 lg:p-8">
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
												className={`absolute inset-0 bg-gradient-to-r from-white/10 via-white/20 to-white/10 opacity-0 group-hover:opacity-100 transition ${
													isActive ? 'opacity-100' : ''
												}`}
												aria-hidden
											/>
										</button>
									)
								})}
						</div>

						<div className="relative overflow-hidden rounded-2xl bg-white text-slate-900 shadow-lg border border-slate-200 min-h-[220px]">
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
												? 'bg-gradient-to-r from-emerald-500 to-green-600 shadow-emerald-600/30 border-emerald-100'
												: 'bg-gradient-to-r from-amber-400 to-orange-500 shadow-amber-500/30 border-amber-100'
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
					</main>

					<footer className="border-t border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 px-4 sm:px-8 py-4 text-sm text-slate-500 flex items-center justify-end gap-6">
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
