import { Routes, Route } from 'react-router'
import AppLayout from './components/AppLayout'
import Home from './pages/Home'
import VideoHub from './pages/VideoHub'
import Analytics from './pages/Analytics'
import Calendar from './pages/Calendar'
import MarketIntel from './pages/MarketIntel'

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/video-hub" element={<VideoHub />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/market-intel" element={<MarketIntel />} />
      </Routes>
    </AppLayout>
  )
}
