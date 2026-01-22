import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Beranda from './pages/beranda'
import Pemantauan from './pages/pemantauan'
import Lokasi from './pages/lokasi'
import Riwayat from './pages/riwayat'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Beranda />} />
        <Route path="/pemantauan" element={<Pemantauan />} />
        <Route path="/lokasi-perangkat" element={<Lokasi />} />
        <Route path="/riwayat-notifikasi" element={<Riwayat />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
