import { Routes, Route } from 'react-router'
import AppLayout from './components/AppLayout'
import AuthGuard from './components/AuthGuard'
import DemoBanner from './components/DemoBanner'
// Game ops (real data)
import { Dashboard, Players, Money, Tournaments, System, AIChat, Connections } from './pages/ops'
// Marketing / content hub (Kirill's tools — mock data until social APIs are wired)
import Home from './pages/Home'
import VideoHub from './pages/VideoHub'
import Analytics from './pages/Analytics'
import Calendar from './pages/Calendar'
import MarketIntel from './pages/MarketIntel'

// Wrap a still-mock marketing page with an honest DEMO banner.
const demo = (what: string, El: React.ComponentType) => (
  <><DemoBanner what={what} /><El /></>
)

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
          <Route path="/connections" element={<Connections />} />
          <Route path="/ai" element={<AIChat />} />
          {/* Marketing / content hub — DEMO data until social APIs connected */}
          <Route path="/market-intel" element={demo('данные рынка/соцсетей', MarketIntel)} />
          <Route path="/content" element={demo('контент-метрики', Home)} />
          <Route path="/video-hub" element={demo('видео-метрики', VideoHub)} />
          <Route path="/analytics" element={demo('соц-аналитика', Analytics)} />
          <Route path="/calendar" element={demo('контент-календарь', Calendar)} />
        </Routes>
      </AppLayout>
    </AuthGuard>
  )
}
