import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
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

type NotificationAPI = {
	_id: string
	deviceID: string
	title: string
	message: string
	severity: string
	createdAt: string
	updatedAt: string
}

type NotificationBucket = {
	total: number
	items: NotificationAPI[]
}

type NotificationsResponse = {
	success: boolean
	data: Record<string, NotificationBucket>
}

const statusOptions: Array<Notification['status']> = ['normal', 'warning', 'info']

const monthIndex: Record<string, number> = {}
const monthNames: Array<Array<string>> = [
	['january', 'januari'],
	['february', 'februari'],
	['march', 'maret'],
	['april'],
	['may', 'mei'],
	['june', 'juni'],
	['july', 'juli'],
	['august', 'agustus'],
	['september'],
	['october', 'oktober'],
	['november'],
	['december', 'desember'],
]

monthNames.forEach((names, idx) => {
	names.forEach((name) => {
		monthIndex[name] = idx
	})
})

function formatDateISO(dateStr: string) {
	const parts = dateStr.trim().split(/\s+/)
	if (parts.length !== 3) return null
	const [dayStr, monthStrRaw, yearStr] = parts
	const dayNum = Number.parseInt(dayStr, 10)
	const monthIdx = monthIndex[monthStrRaw.toLowerCase()]
	const yearNum = Number.parseInt(yearStr, 10)
	if (Number.isNaN(dayNum) || Number.isNaN(monthIdx) || Number.isNaN(yearNum)) return null
	const utcDate = new Date(Date.UTC(yearNum, monthIdx, dayNum))
	return utcDate.toISOString().slice(0, 10)
}

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

const normalizeStatus = (severity?: string): Notification['status'] => {
	const normalized = (severity || '').toLowerCase()
	if (normalized === 'warning' || normalized === 'high' || normalized === 'critical') return 'warning'
	if (normalized === 'info') return 'info'
	return 'normal'
}

const formatDateDisplay = (iso?: string) => {
	if (!iso) return 'Tanggal tidak diketahui'
	const date = new Date(iso)
	return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

const formatTimeDisplay = (iso?: string) => {
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

const mapNotificationsToDayGroups = (buckets: Record<string, NotificationBucket>): { days: DayGroup[]; devices: string[] } => {
	const grouped: Record<string, DayGroup> = {}
	const deviceSet = new Set<string>()

	Object.values(buckets || {}).forEach((bucket) => {
		bucket.items.forEach((item) => {
			const dateLabel = formatDateDisplay(item.createdAt)
			const status = normalizeStatus(item.severity)
			const device = item.deviceID || 'Unknown Device'
			deviceSet.add(device)

			const mapped: Notification = {
				title: item.title || 'Notifikasi',
				device,
				description: item.message || '-',
				time: formatTimeDisplay(item.createdAt),
				ago: formatAgo(item.createdAt),
				status,
			}

			if (!grouped[dateLabel]) {
				grouped[dateLabel] = { date: dateLabel, total: 0, items: [] }
			}

			grouped[dateLabel].items.push(mapped)
			grouped[dateLabel].total += 1
		})
	})

	const days = Object.values(grouped).sort((a, b) => {
		const aISO = formatDateISO(a.date) || ''
		const bISO = formatDateISO(b.date) || ''
		return bISO.localeCompare(aISO)
	})

	return { days, devices: Array.from(deviceSet) }
}

export default function Riwayat() {
	const [tabs, setTabs] = useState<string[]>(['All Devices'])
	const [activeTab, setActiveTab] = useState<string>('All Devices')
	const [days, setDays] = useState<DayGroup[]>([])
	const [sidebarOpen, setSidebarOpen] = useState(false)
	const [filterOpen, setFilterOpen] = useState(false)
	const [activeDayISO, setActiveDayISO] = useState<string>('')
	const [activeStatus, setActiveStatus] = useState<'' | Notification['status']>('')
	const [isLoading, setIsLoading] = useState(false)

	useEffect(() => {
		let isMounted = true

		const fetchNotifications = async () => {
			setIsLoading(true)
			try {
				const res = await axios.get<NotificationsResponse>('http://localhost:3000/api/notifications')
				if (!isMounted) return
				const { days: mappedDays, devices } = mapNotificationsToDayGroups(res.data?.data || {})
				setDays(mappedDays)
				const newTabs = ['All Devices', ...devices]
				setTabs(newTabs)
				setActiveTab((current) => (newTabs.includes(current) ? current : 'All Devices'))
			} catch (error) {
				console.error('Failed to fetch notifications', error)
			} finally {
				if (isMounted) setIsLoading(false)
			}
		}

		fetchNotifications()
		const intervalId = setInterval(fetchNotifications, 30000)

		return () => {
			isMounted = false
			clearInterval(intervalId)
		}
	}, [])

	const filteredDays = useMemo(() => {
		return days
			.filter((day) => {
				if (!activeDayISO) return true
				const iso = formatDateISO(day.date)
				return iso === activeDayISO
			})
			.map((day) => ({
				...day,
				items: day.items.filter((item) => {
					const matchDevice = activeTab === 'All Devices' || item.device === activeTab
					const matchStatus = activeStatus === '' || item.status === activeStatus
					return matchDevice && matchStatus
				}),
				total: day.items.filter((item) => {
					const matchDevice = activeTab === 'All Devices' || item.device === activeTab
					const matchStatus = activeStatus === '' || item.status === activeStatus
					return matchDevice && matchStatus
				}).length,
			}))
			.filter((day) => day.items.length > 0)
	}, [activeTab, activeDayISO, activeStatus, days])

	return (
		<div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col">
			<Navbar onMenuToggle={() => setSidebarOpen((prev) => !prev)} isMenuOpen={sidebarOpen} />

			<div className="flex flex-1">
				<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

				<div className="flex-1 flex flex-col">
					<main className="flex-1 p-4 sm:p-6 lg:p-8">
						<div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-5 sm:space-y-6">
							<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<p className="text-lg sm:text-xl font-semibold text-slate-800">Riwayat Notifikasi</p>
								<div className="relative self-end sm:self-auto">
									<button
										onClick={() => setFilterOpen((prev) => !prev)}
										type="button"
										aria-expanded={filterOpen}
										className="flex items-center gap-2 rounded-full border border-slate-200 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-600 hover:bg-slate-50"
									>
										<span className="text-base" aria-hidden>
											⚲
										</span>
										<span className="inline sm:inline">Filter</span>
									</button>

									{filterOpen && (
										<div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70 z-50 p-3 space-y-3 text-sm text-slate-700">
											<div className="space-y-1">
												<label className="px-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">Device</label>
												<select
													className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 bg-white"
													value={activeTab}
													onChange={(e) => {
														setActiveTab(e.target.value)
													}}
												>
													{tabs.map((tab) => (
														<option key={`opt-${tab}`} value={tab}>
															{tab}
														</option>
													))}
												</select>
											</div>

											<div className="space-y-1">
												<label className="px-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">Hari</label>
												<input
													type="date"
													className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 bg-white"
													value={activeDayISO}
													onChange={(e) => {
														setActiveDayISO(e.target.value)
													}}
												/>
											</div>

											<div className="space-y-1">
												<label className="px-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">Status</label>
												<select
													className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm text-slate-700 bg-white"
													value={activeStatus}
													onChange={(e) => {
														setActiveStatus(e.target.value as '' | Notification['status'])
													}}
												>
													<option value="">All Status</option>
													{statusOptions.map((status) => (
														<option key={`opt-status-${status}`} value={status}>
															{status}
														</option>
													))}
												</select>
											</div>

											<div className="flex items-center justify-end gap-2 pt-1">
												<button
													type="button"
													className="text-xs text-slate-500 hover:text-slate-700"
													onClick={() => {
														setActiveTab(tabs[0])
														setActiveDayISO('')
														setActiveStatus('')
														setFilterOpen(false)
													}}
												>
													Reset
												</button>
											</div>
										</div>
									)}
								</div>
							</header>

										{isLoading && <p className="text-xs text-slate-500">Memuat notifikasi...</p>}

							<div className="space-y-6 sm:space-y-8">
								{filteredDays.length === 0 ? (
									<div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
										Tidak ada informasi
									</div>
								) : (
									filteredDays.map((day) => (
										<div key={day.date} className="space-y-3">
											<div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
												<span className="text-sky-600">◉</span>
												{day.date}
												<span className="ml-auto text-[11px] sm:text-xs font-normal text-slate-500">{day.total} notifikasi</span>
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
																<span className={`text-[10px] sm:text-[11px] font-semibold px-3 py-1 rounded-full ${styles.badge}`}>{item.ago}</span>
															</div>
															<div className="mt-2 text-[11px] sm:text-xs text-slate-500">{item.time}</div>
														</div>
													)
												})}
											</div>
										</div>
									))
								)}
							</div>
						</div>
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
