import { Routes, Route } from 'react-router'
import AppLayout from './components/AppLayout'
import AuthGuard from './components/AuthGuard'
// Game ops (real data)
import { Dashboard, Players, Money, Tournaments, System, AIChat } from './pages/ops'
// Marketing / content hub (Kirill's tools)
import Home from './pages/Home'
import VideoHub from './pages/VideoHub'
import Analytics from './pages/Analytics'
import Calendar from './pages/Calendar'
import MarketIntel from './pages/MarketIntel'

export default function App() {
  return (
    <AuthGuard>
      <AppLayout>
        <Routes>
          {/* Real operations — live project data */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/players" element={<Players />} />
          <Route path="/money" element={<Money />} />
          <Route path="/tournaments" element={<Tournaments />} />
          <Route path="/system" element={<System />} />
          <Route path="/ai" element={<AIChat />} />
          {/* Marketing / content hub */}
          <Route path="/market-intel" element={<MarketIntel />} />
          <Route path="/content" element={<Home />} />
          <Route path="/video-hub" element={<VideoHub />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/calendar" element={<Calendar />} />
        </Routes>
      </AppLayout>
    </AuthGuard>
  )
}
