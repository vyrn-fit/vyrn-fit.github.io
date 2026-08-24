# Vyrn

**Show up. Put in the work.**

Vyrn is a social, equipment-free fitness app focused on home and office bodyweight training with weekly Hyrox-style challenges.

## Current Goal
Mobile-ready **Progressive Web App (PWA)** first.  
Native iOS/Android builds come later with the same codebase.

## Stack
- Expo (React Native) + Expo Router + TypeScript
- Supabase (Auth, Database, Realtime)
- Zustand + TanStack Query
- Fully responsive dark UI

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Create .env file
cp .env.example .env
# Then paste your Supabase URL + anon key

# 3. Run as web / PWA
npx expo start --web
```

Open the browser, then on your phone you can **Add to Home Screen** for the full app-like experience.

### Useful commands
```bash
npx expo start          # Dev server (choose web / iOS / Android)
npx expo start --web    # Web / PWA mode
npm run build:web       # Static export for GitHub Pages later
```

## Project Structure
```
app/           → Screens (Expo Router)
components/    → Reusable UI
lib/           → Supabase client
store/         → Zustand stores
types/         → TypeScript types
public/        → PWA manifest & static assets
```

## Roadmap
- [x] Auth (email)
- [x] Basic screens (Home, Challenge, Profile)
- [ ] Onboarding quiz
- [ ] Workout player
- [ ] Real weekly challenges + leaderboards
- [ ] PWA install prompt + offline support
- [ ] Native builds (later)

## License
Private
