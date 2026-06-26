# Plan: Bombermeme AI Content Hub (Viral Command Center)

## Architecture
Full-stack React webapp — Dashboard для управления вирусным контентом Bombermeme.

### Core Features
1. **Social Media Tracker** — метрики соцсетей в реальном времени (X, TikTok, Instagram, Telegram, YouTube)
2. **AI Video Upload & Analysis** — drag-drop видео → AI анализирует лучшие моменты (kills, clutch, near-death)
3. **Smart Clip Editor** — AI-нарезка viral клипов под каждую платформу с автокадрированием
4. **Caption & Hashtag Generator** — AI генерирует тексты, хештеги, mentions based on аналитике 2026
5. **Viral Predictor** — ML-модель оценивает вирусный потенциал контента (0-100 score)
6. **Content Calendar** — планировщик постов с оптимальным временем
7. **Market Intelligence** — аналитика рынка Web3 gaming из отчётов
8. **KOL Tracker** — база инфлюенсеров, статус outreach, Rev-Share tracking

### Tech Stack
- Frontend: React 19 + TypeScript + Tailwind CSS + shadcn/ui + Vite
- Backend: tRPC + Drizzle + Hono (fullstack)
- Auth: Kimi OAuth
- Charts: Recharts
- Animations: GSAP + Framer Motion

### Pipeline
**Phase 1**: Init project + research + backend graft
**Phase 2**: Design (Pro_Designer)
**Phase 3**: Read design + scaffold
**Phase 4**: Scaffold implementation
**Phase 5**: Page branches (Dashboard, Video Hub, Analytics, Content Calendar)
**Phase 6**: Merge + build + deploy
