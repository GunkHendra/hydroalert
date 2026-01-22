import { useMemo, useState } from 'react'
import { Navbar } from '../components/Navbar'
import { Sidebar } from '../components/Sidebar'

type Notification = {
	title: string
	device: string
	description: string
	time: string
	ago: string
	status: 'normal' | 'warning' | 'info'
}

type DayGroup = {
	date: string
	total: number
	items: Notification[]
}

const tabs = ['All Devices', 'Device A', 'Device B', 'Device C']

const days: DayGroup[] = [
	{
		date: '11 November 2025',
		total: 4,
		items: [
			{
				title: 'Sistem Normal',
				device: 'Device A',
				description: 'Semua sensor berfungsi dengan baik',
				time: '14:30',
				ago: '2 jam lalu',
				status: 'normal',
			},
			{
				title: 'Peringatan Hujan Sedang',
				device: 'Device B',
				description: 'Intensitas hujan 25 mm/jam terdeteksi',
				time: '13:15',
				ago: '3 jam lalu',
				status: 'warning',
			},
			{
				title: 'Sensor Diperbaharui',
				device: 'Device C',
				description: 'Kalibrasi sensor selesai dilakukan',
				time: '11:00',
				ago: '5 jam lalu',
				status: 'info',
			},
			{
				title: 'Level Air Normal',
				device: 'Device A',
				description: 'Ketinggian air 120 cm dalam batas normal',
				time: '09:45',
				ago: '7 jam lalu',
				status: 'normal',
			},
		],
	},
	{
		date: '10 November 2025',
		total: 3,
		items: [
			{
				title: 'Debit Air Meningkat',
				device: 'Device B',
				description: 'Peningkatan debit air mencapai 30 mm/jam',
				time: '18:20',
				ago: '1 hari lalu',
				status: 'warning',
			},
			{
				title: 'Maintenance Terjadwal',
				device: 'Device A',
				description: 'Pengecekan rutin jaringan sensor',
				time: '15:00',
				ago: '1 hari lalu',
				status: 'info',
			},
			{
				title: 'Kalibrasi Sensor Hujan',
				device: 'Device C',
				description: 'Kalibrasi selesai dan stabil',
				time: '09:10',
				ago: '1 hari lalu',
				status: 'normal',
			},
		],
	},
]

function statusClasses(status: Notification['status']) {
	switch (status) {
		case 'warning':
			return {
				border: 'border-amber-300',
				badge: 'bg-amber-100 text-amber-700',
				icon: 'text-amber-500 border-amber-200',
			}
		case 'info':
			return {
				border: 'border-sky-200',
				badge: 'bg-sky-100 text-sky-700',
				icon: 'text-sky-500 border-sky-200',
			}
		default:
			return {
				border: 'border-emerald-300',
				badge: 'bg-emerald-100 text-emerald-700',
				icon: 'text-emerald-500 border-emerald-200',
			}
	}
}

export default function Riwayat() {
	const [activeTab, setActiveTab] = useState<string>(tabs[0])

	const filteredDays = useMemo(() => {
		if (activeTab === 'All Devices') return days

		return days
			.map((day) => ({
				...day,
				items: day.items.filter((item) => item.device === activeTab),
			}))
			.filter((day) => day.items.length > 0)
	}, [activeTab])

	return (
		<div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
			<Navbar />

			<div className="flex flex-1">
				<Sidebar />

				<div className="flex-1 flex flex-col">
					<main className="flex-1 p-8">
						<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
							<header className="flex items-center justify-between">
								<p className="text-xl font-semibold text-slate-800">Riwayat Notifikasi</p>
								<button className="flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
									<span className="text-base">⚲</span>
									Filter
								</button>
							</header>

							<div className="flex flex-wrap items-center gap-3">
								{tabs.map((tab) => {
									const isActive = tab === activeTab
									return (
										<button
											key={tab}
											onClick={() => setActiveTab(tab)}
											aria-pressed={isActive}
											className={`group relative overflow-hidden rounded-xl px-4 py-2 text-sm font-semibold border transition flex items-center gap-2 ${
												isActive
													? 'text-white border-sky-300 shadow-lg shadow-sky-200/60'
													: 'text-slate-500 border-slate-200 hover:text-slate-700 hover:shadow-sm'
											}`}
											style={isActive ? { background: 'linear-gradient(135deg, #0ea5e9 0%, #22c55e 60%, #0ea5e9 100%)', boxShadow: '0 12px 36px rgba(14,165,233,0.35)' } : undefined}
										>
											<span className={`h-2 w-2 rounded-full transition ${isActive ? 'bg-white shadow-[0_0_0_4px_rgba(255,255,255,0.18)]' : 'bg-slate-300 group-hover:bg-slate-400'}`} />
											<span className="relative z-10">{tab}</span>
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

							<div className="space-y-8">
								{filteredDays.map((day) => (
									<div key={day.date} className="space-y-3">
										<div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
											<span className="text-sky-600">◉</span>
											{day.date}
											<span className="ml-auto text-xs font-normal text-slate-500">{day.total} notifikasi</span>
										</div>

										<div className="space-y-3">
											{day.items.map((item) => {
												const styles = statusClasses(item.status)
												return (
													<div
														key={`${day.date}-${item.title}-${item.time}`}
														className={`rounded-2xl border bg-white px-4 py-3 shadow-sm ${styles.border}`}
													>
														<div className="flex items-start justify-between gap-3">
															<div className="flex items-start gap-3">
																<span className={`mt-0.5 h-7 w-7 rounded-full border grid place-items-center text-sm font-semibold ${styles.icon}`}>
																	{item.status === 'warning' ? '⚠' : item.status === 'info' ? 'ℹ' : '✓'}
																</span>
																<div className="space-y-0.5">
																	<p className="text-sm font-semibold text-slate-800">{item.title}</p>
																	<p className="text-xs text-slate-500">{item.device}</p>
																	<p className="text-xs text-slate-600">{item.description}</p>
																</div>
															</div>
															<span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${styles.badge}`}>{item.ago}</span>
														</div>
														<div className="mt-2 text-xs text-slate-500">{item.time}</div>
													</div>
												)
											})}
										</div>
									</div>
								))}
							</div>
						</div>
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
