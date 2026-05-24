# WordReader

WordReader is a mobile-first PWA for Thai learners who want to improve English by reading real news and saved articles. It turns reading into a study loop: discover or import an article, read in a clean Reader Mode, ask AI for help, save useful vocabulary, and review it later with spaced repetition.

## Current Features

- **Live news feed** - Browse current headlines from multiple news sources inside the app.
- **URL import** - Paste an article URL and WordReader extracts a clean reader copy.
- **Text import** - Paste your own article text when extraction is unavailable or you want to study custom material.
- **Reader Mode** - Read distraction-free articles with saved-word highlights, reading progress, resume support, adjustable font size, line spacing, theme controls, sharing, and read-aloud support.
- **AI lookup** - Select a word, sentence, or paragraph to get Thai-friendly translation, explanation, gist, grammar notes, and key phrase help.
- **AI reading tools** - Optional chunking/collocation help and idiom or phrasal verb detection.
- **Vocabulary library** - Save words with Thai meaning, English meaning, part of speech, difficulty, context, source, folders, tags, notes, favorites, and detail pages.
- **SRS review** - Practice saved words with a simplified spaced repetition schedule, daily goals, due counts, streaks, and review history.
- **Article notes** - Save personal notes per article.
- **Article quiz** - Generate a short comprehension quiz for an article and keep the latest quiz with that article.
- **Settings sync** - Sync reading preferences, review goal, notification preferences, offline preference, lookup style, tap behavior, and UI language preference through Supabase.
- **PWA support** - Add to Home Screen on iPhone/iPad Safari and use the app in standalone mode.

## Offline And PWA Notes

WordReader includes a service worker for static assets and local browser storage for a limited offline cache. Opened articles, vocabulary snapshots, and a review deck can be available later from the same browser.

Offline support is intentionally limited today:

- Live news, article extraction, AI lookup, AI quiz generation, AI chunking, and idiom detection require a network connection.
- Offline article and vocabulary data is stored locally in the browser, not in a full IndexedDB sync queue yet.
- Offline review can use the cached deck, but only online review sessions sync schedule updates back to Supabase.
- Clearing browser storage removes local offline copies.

## Tech Stack

- **Next.js 16** with App Router and TypeScript
- **React 19**
- **Tailwind CSS v4**
- **Supabase** for Auth, Postgres, Row Level Security, profiles, articles, vocabulary, review state, notes, quizzes, and settings
- **OpenAI API** for structured word, sentence, paragraph, quiz, chunking, and idiom assistance
- **Vercel** deployment target
- **PWA** manifest and service worker

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in your local values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
OPENAI_API_KEY=
```

Do not commit `.env.local` or any file containing real secrets.

### 3. Create a Supabase project

1. Create a Supabase project.
2. Copy the project URL and anon public key into `.env.local`.
3. Run the SQL migrations in `supabase/migrations` in order, or use the Supabase CLI if your environment is configured for it.

The app expects these main tables and functions to exist:

- `profiles`
- `articles`
- `reading_history`
- `vocabulary_items`
- `vocabulary_contexts`
- `review_states`
- `review_events`
- `user_settings`
- `article_notes`
- `article_quizzes`
- `save_vocabulary_entry`

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Verify

```bash
npm run lint
npx tsc --noEmit
```

### 6. Deploy

Deploy to Vercel and add the same environment variables in the Vercel project settings. Keep secret values in Vercel environment variables, not in the repository.

## Project Structure

```text
src/
  app/                    Pages and API routes (App Router)
    api/                  Server-side article, AI, quiz, and news endpoints
    auth/                 Sign in, sign up, and auth callback
    read/                 Article discovery, import, reader, and offline reader pages
    review/               SRS flashcard review page
    settings/             Account, reading, review, offline, and reminder settings
    vocabulary/           Vocabulary list and detail pages
  components/
    auth/                 Authentication UI
    common/               Shared UI helpers
    home/                 Dashboard widgets
    layout/               App shell, navigation, settings providers
    news/                 News preview UI
    reader/               Reader controls, lookup popups, notes, and quiz
    review/               Flashcard UI
    vocabulary/           Vocabulary list and cards
  hooks/                  Reader selection, news feed, and import hooks
  lib/                    Supabase, OpenAI, extraction, news, offline, SRS, and reader utilities
  types/                  Shared TypeScript interfaces
supabase/
  migrations/             Database schema and feature migrations
public/
  icons/                  PWA icons
  sw.js                   Service worker
  manifest.json           PWA manifest
```

## Development Phases

- [x] **Phase 1 - Foundation**: Next.js app, TypeScript, app shell, mobile-first layout, dark mode, PWA manifest, service worker, and Vercel config
- [x] **Phase 2 - Auth and sync**: Supabase auth, profiles, RLS, synced user settings, profile self-heal, and protected user data
- [x] **Phase 3 - Article discovery and import**: Live news feed, URL article extraction, manual text import, article saving, and reading history
- [x] **Phase 4 - Reader Mode**: Clean reader page, progress tracking, resume support, offline article copies, reader preferences, saved-word highlights, read aloud, and share/open-original actions
- [x] **Phase 5 - AI reading support**: Word, sentence, and paragraph lookup; Thai-friendly explanations; reading chunking; idiom and phrasal verb detection; and comprehension quiz generation
- [x] **Phase 6 - Vocabulary library**: Save vocabulary with article context, organize with folders/tags/notes/favorites, view detail pages, and play word/context audio
- [x] **Phase 7 - SRS review**: Due deck, simplified spaced repetition scheduling, daily goal, streaks, review events, and offline cached deck
- [x] **Phase 8 - Polish and production readiness**: Settings page, onboarding checklist, notification preferences, cache boundaries, rate limiting, HTML sanitization, and production deploy setup

## Next Roadmap

- **Listening mode** - Add guided listening practice using article audio, sentence replay, shadowing, and comprehension checks.
- **CEFR profile** - Track learner level, estimate article difficulty, and recommend content and vocabulary by CEFR band.
- **AI cache** - Persist repeatable AI outputs such as lookups, idioms, chunked reader HTML, and quizzes to reduce latency and API cost.
- **Analytics** - Track learning progress, retention, reading time, article completion, saved-word quality, review consistency, and feature usage.
- **IndexedDB offline sync** - Move offline articles, vocabulary, review actions, and sync queues from simple local storage to a more durable IndexedDB-backed model.

## Repository Hygiene

The repository should not include local secrets or generated output. Keep these out of commits and zip exports:

- `.env.local` and other `.env*` files with real values
- `.git/`
- `.next/`
- `node_modules/`
- `.vercel/`
- `coverage/`
- `build/`, `dist/`, `out/`, and `output/`

Use `.env.example` for placeholder keys only.
