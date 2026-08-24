# Vyrn

**Show up. Put in the work. Compete.**

Vyrn is a social, equipment-free fitness app focused on home and office bodyweight training with weekly Hyrox-style challenges.

## Stack

- **Frontend**: Expo (React Native) + TypeScript + Expo Router
- **UI**: NativeWind (Tailwind CSS)
- **Backend**: Supabase (Auth, Postgres, Realtime, Storage)
- **State**: Zustand + TanStack Query

## Getting Started

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your Supabase keys
3. `npm install`
4. `npx expo start`

## Project Structure

```
app/           # Expo Router screens
components/    # Reusable UI components
lib/           # Supabase client, utils
store/         # Zustand stores
types/         # TypeScript types
```

## MVP Features

- [ ] Auth (email + social)
- [ ] Onboarding quiz
- [ ] Bodyweight workout player
- [ ] Weekly challenges + leaderboards
- [ ] Social features (cheers, share)
- [ ] Free + Pro ($7/mo) tiers

## License

Private - All rights reserved
