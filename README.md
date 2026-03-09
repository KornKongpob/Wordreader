# WordReader

Learn English by reading real news articles. A mobile-first PWA optimized for iPhone and iPad Safari.

## What This App Does

1. **Read** — Paste a CNN article URL → get a clean Reader Mode page
2. **Learn** — Tap any word → get Thai translation + contextual explanation from AI
3. **Save** — Build your personal vocabulary library
4. **Review** — Practice with spaced repetition flashcards
5. **Sync** — Everything syncs across your iPhone and iPad

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Supabase** (Auth, Postgres, Row Level Security)
- **OpenAI API** (gpt-4o-mini for translations)
- **Vercel** (deployment)
- **PWA** (Add to Home Screen on Safari)

---

## Setup Instructions

### 1. Create a Supabase Project (free)

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click **New Project** → pick a name (e.g. `wordreader`) → set a database password → click **Create**
3. Wait for the project to finish setting up (~1 minute)
4. Go to **Settings** → **API** and copy:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **anon public key** (a long string starting with `eyJ...`)

### 2. Run the Database Schema

1. In your Supabase dashboard, go to **SQL Editor** → **New Query**
2. Paste the contents of `supabase/migrations/001_initial_schema.sql`
3. Click **Run**
4. You should see "Success. No rows returned" — that means it worked

### 3. Configure Environment Variables

1. In the project root, create a file called `.env.local`
2. Add your keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 4. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Deploy to Vercel

1. Push the code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → **Import Project** → select your repo
3. Add the same environment variables from step 3 in Vercel's project settings
4. Click **Deploy**

### 6. Add to Home Screen (iPhone/iPad)

1. Open your deployed URL in Safari
2. Tap the **Share** button (square with arrow)
3. Tap **Add to Home Screen**
4. The app will open in standalone mode — no browser chrome

---

## Project Structure

```
src/
├── app/                    # Pages (App Router)
│   ├── layout.tsx          # Root layout + PWA meta
│   ├── page.tsx            # Home page
│   ├── auth/               # Sign in / sign up
│   ├── read/               # Article reader
│   ├── vocabulary/         # Saved words
│   ├── review/             # Flashcard review
│   ├── settings/           # App settings
│   └── api/                # Server-side API routes
├── components/             # Reusable React components
│   ├── layout/             # AppShell, BottomNav, ThemeProvider
│   └── auth/               # AuthForm
├── lib/                    # Utilities
│   └── supabase/           # Supabase client (browser + server)
└── types/                  # TypeScript interfaces
```

---

## Development Phases

- [x] **Phase 1** — Project setup, auth, app shell, PWA, dark mode
- [ ] **Phase 2** — CNN article extraction + Reader Mode
- [ ] **Phase 3** — Word selection + OpenAI translation + vocabulary saving
- [ ] **Phase 4** — Vocabulary library + detail pages
- [ ] **Phase 5** — Flashcard review + spaced repetition
- [ ] **Phase 6** — Settings sync, polish, production deploy
