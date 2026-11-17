# Fitio (Liftio)

A workout tracker for iOS and Android with an AI personal trainer. It logs sets fast mid-workout, works fully offline, syncs to Supabase when you sign in, and turns your history into analytics and coaching.

Built with Expo SDK 58 · React Native 0.88 · TypeScript · Expo Router · NativeWind · Zustand · TanStack Query · Reanimated 4 · Victory Native XL · React Hook Form + Zod · Expo SQLite · Supabase.

## Run it

```bash
npm install          # also copies Skia's web runtime into public/
npx expo start       # press a / i, or scan the QR code with Expo Go
```

Every native module used ships in Expo Go, so no development build is needed to try it. Without Supabase keys the app runs in **offline guest mode** and seeds 12 weeks of sample training history so every screen has data. Clear it in *Profile → Settings → Data*.

`npx expo start --web` also works for quick previews. A small service worker (`public/coi-serviceworker.js`) adds the cross-origin isolation headers expo-sqlite needs on web.

| Script | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (Expo config + React Compiler rules) |
| `npm run generate:seed` | Regenerates `supabase/seed.sql` and the coach's catalog from the bundled exercise library |
| `npm run generate:images` | Rebuilds the photo manifest after you add images (see below) |
| `npm run generate:noise` | Regenerates the film-grain texture |

## Connect Supabase (accounts, sync, cloud AI)

1. Create a project, then copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Apply the schema and seed (tables, indexes, RLS, storage buckets, 35 exercises):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   npx supabase db reset --linked   # or run supabase/seed.sql in the SQL editor
   ```
3. Deploy the Edge Functions. The model key is stored only as a Supabase secret and never ships in the app:
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=<key>
   npx supabase functions deploy ai-coach
   npx supabase functions deploy delete-account
   ```
4. Set `EXPO_PUBLIC_AI_PROVIDER=edge` to use the cloud coach. Leave it as `local` to keep the on-device engine.

## How it fits together

```
src/
  app/            Expo Router screens: (tabs)/, exercises/, workout/, coach/, profile/, auth/
  components/     ui/ (design system), dashboard/, exercises/, workout/, analytics/, coach/, navigation/
  features/       domain logic per area: auth, exercises, workouts, progress, ai-coach, profile
  services/       SQLite (db.ts), Supabase client, sync engine + outbox, notifications, avatar upload
  store/          Zustand: active workout (persisted), settings (persisted), template draft
  lib/ hooks/ types/ constants/
supabase/         migrations, seed.sql, Edge Functions (ai-coach, delete-account)
```

- **Offline first.** Every write goes to SQLite first and is recorded in a `sync_queue` outbox. When the user is signed in and online, the queue is pushed in order on reconnect, on app foreground and every 5 minutes. On first sign-in on a device, the user's history is pulled down once. Guest data moves to the new account when the user signs up.
- **Active workout** state is a persisted Zustand store, so a session survives the app being closed. The rest timer stores an end time rather than a countdown for the same reason. Finishing writes normalized rows (workouts → exercises → sets) and recomputes personal records.
- **AI coach.** The UI talks to a `CoachProvider` (`features/ai-coach/service.ts`). The `local` provider is a rule engine grounded in the user's own logs: recovery by muscle group, progression from last performance, and goals. The `edge` provider calls the `ai-coach` Edge Function, which uses Claude (`claude-opus-5-5`) with strict JSON output, so recommended exercises always come from the catalog, plus refusal fallback. It falls back to the local engine if the call fails. Settings → Privacy can stop workout history from being sent to the coach.
- **Units.** Weights are always stored in kg and converted for display (kg/lb setting).
- **Themes.** Dark (default), Pure black, Light, or System (follows the phone). Palettes live in `src/constants/tokens.json`. Components read colors through `useColors()`, and surfaces use NativeWind CSS variables set per theme. Areas over photos (hero banners, exercise headers, card labels) are wrapped in `<ThemeScope mode="dark">`, so their text stays white in light mode.
- **Navigation.** A custom floating tab bar where the active tab rises into an orange button that slides between tabs (`components/navigation/floating-tab-bar.tsx`).

## Photography

All 35 exercises have a photo, plus the Home hero (Train reuses it) and the AI coach portrait. They're bundled as compressed 1080 px JPEGs, about 4 MB in total. The Figma originals are in `design/figma-images/` and aren't bundled. To replace a photo, overwrite `assets/images/exercises/<slug>.jpg` (or `gym/<name>.jpg`) and run `npm run generate:images`. Designed fallback art still covers any exercise added later without a photo. See `assets/images/README.md` for sizing and art direction.

## Notes

- App icon and splash still use the Expo template artwork.
- Charts use Skia. On web, CanvasKit loads lazily and charts show a skeleton until it's ready.
