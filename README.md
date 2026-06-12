# Madinah Arabic

A modern Arabic learning platform for the Madinah Arabic book series. The app currently includes curated Book 1, Book 2, and Book 3 lesson data, book-aware vocabulary, grammar notes, lesson exercises, random vocabulary quizzes, learner progress, and a clean premium dashboard UI.

## Features

- Public landing page with sign-in gating for course content
- Dark and light dashboard themes
- Book 1, Book 2, and Book 3 lesson paths
- Per-lesson Learn, Book Exercises, and Vocabulary Quiz tabs
- Three Learn examples per lesson, ordered by increasing complexity
- Collapsible exercise sections labelled A, B, C, etc.
- At least five practice sections per lesson
- Lesson vocabulary quizzes with randomized regenerated questions
- Vocabulary list split by book, ready for Book 2 and Book 3 growth
- Vocab Tester for regenerated 3-question tests across selected content
- No transliteration questions in vocabulary quizzes
- Browser speech-synthesis audio notes with final-vowel pronunciation
- Free and premium plan UI with locked premium surfaces
- Account details page, local sign-up/sign-in, progress saving, and sign out
- Forgotten password, reset password, and email-verification flows
- Admin-only content management for vocabulary, lessons, examples, exercise prompts, and exercises
- Structured server logs and frontend error telemetry
- Installable mobile PWA metadata with offline shell caching
- Capacitor iOS and Android mobile app shells that load the same platform
- English interface active; Bengali localization data is preserved but hidden for now

## Current Auth Notes

The app supports local email/password registration, login, logout, password hashing, forgotten-password reset tokens, and email verification tokens.

In local development and tests, reset/verification endpoints return a `devToken` so the flow is usable without an email provider. In production (`NODE_ENV=production`), tokens are not returned in API responses; connect a transactional email provider before launching publicly.

Automated tests seed these accounts:

- Premium/admin test account: `99muhammad.r@gmail.com` / `test123`
- Free test account: `free.madinah@example.com` / `test123`

Local runtime account files are intentionally ignored by Git. A fresh clone can register accounts through the UI, or MongoDB can be seeded for deployment.

## Setup

Install dependencies:

```sh
npm install
```

Run locally:

```sh
npm run dev
```

Then open:

```text
http://localhost:4173
```

If port `4173` is busy, run with another port:

```sh
PORT=4175 npm run dev
```

## MongoDB

The app runs without MongoDB by falling back to local JSON persistence. For MongoDB, copy `.env.example` to `.env` and set:

```sh
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.example.mongodb.net/?appName=Cluster0"
MONGODB_DB="madinah_arabic"
```

Do not commit `.env`. It is ignored by Git.

## Tests

Run unit, content, and integration/API tests:

```sh
npm run test
```

Run content validation directly:

```sh
npm run validate:content
```

Run Selenium end-to-end tests:

```sh
npm run test:selenium
```

Run Playwright visual screenshot checks:

```sh
npm run test:visual
```

Run the vocabulary load check:

```sh
npm run test:load
```

Sync the native mobile shells after changing mobile config/assets:

```sh
npm run mobile:sync
```

Run the full suite:

```sh
npm run test:all
```

Current coverage includes:

- Curriculum counts and Book 1/2/3 data integrity
- Arabic diacritic validation
- Vocabulary translation hygiene and pronunciation-note checks
- Slash formatting for paired verb forms
- Auth login/register/logout/session behavior
- Forgotten password, reset password, and email verification behavior
- Admin content loading/editing and non-admin blocking
- HttpOnly cookie session behavior
- Server-side free vs premium entitlement filtering
- Login rate limiting and progress update validation
- Password-hash response leakage checks
- Frontend error telemetry endpoint checks
- Static-file exposure checks for `.env`, user JSON, and source files
- Free vs premium UI gating
- Account details and sign-out browser flows
- Playwright desktop/mobile visual screenshots and overflow checks
- Vocabulary-heavy bootstrap load checks
- Lesson practice tabs, quizzes, and vocabulary tester flows
- Mobile-width landing/login smoke test
- PWA manifest/service-worker and Capacitor config checks

## Mobile App

The repo includes a Capacitor mobile app shell in `ios/` and `android/`, plus a fallback shell in `mobile/www/`.

By default `capacitor.config.json` points the mobile app at:

```text
http://localhost:4173
```

For production, deploy the web/API app to HTTPS and change `server.url` to that hosted URL. For Android emulator local testing, use `http://10.0.2.2:4173` instead of `localhost`.

Open the native projects with:

```sh
npm run mobile:ios
npm run mobile:android
```

## Repository Hygiene

The repository commits source, tests, package metadata, design reference assets, database seed helpers, and curated `data/curriculum.json`.

The following are ignored:

- `node_modules/`
- `.vendor/`
- `.env` and `.env.*`
- Local JSON runtime state: `data/progress.json`, `data/users.json`, `data/progress-users.json`
- Generated OCR/extraction text files
- Logs, coverage, screenshots, and test artifacts

## Production Notes

The free/premium split is enforced server-side for bootstrap data as well as in the UI. Free and anonymous users receive Book 1 content plus locked Book 2/3 metadata; premium users receive the full Book 1-3 curriculum.

Security controls currently include HttpOnly same-site session cookies, in-memory session expiry, login/register throttling, progress update validation, static asset allowlisting, and baseline browser security headers.

Before production launch, rotate any MongoDB credentials that were shared outside `.env`, set `COOKIE_SECURE=true` behind HTTPS, wire reset/verification tokens to a real email provider, restrict admin accounts carefully, forward structured JSON logs to a log platform, and consider moving sessions/rate limits to a shared store if the app runs on more than one server process.
