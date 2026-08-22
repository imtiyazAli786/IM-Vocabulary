
# Vocabulary Revision App — Plan

A mobile-first installable web app (PWA) that helps you remember vocabulary through spaced-repetition flashcards, a daily quiz, and a word of the day. Words sync across devices via login.

## Core features

1. **Auth** — Email/password + Google sign-in (Lovable Cloud).
2. **My Words library** — list, search, edit, delete; tag/categorize.
3. **Add a word** with these fields:
   - Word
   - Part of speech (noun/verb/adj…)
   - English definition
   - Urdu translation
   - Example sentence (English)
   - Example sentence (Urdu)
   - Optional notes
4. **Import from your document** — upload your existing vocabulary file (PDF / Word / Excel / text). I parse it and use AI to fill any missing fields (Urdu translation, example sentences) so the import lands fully populated. You review before saving.
5. **Flashcards (Spaced Repetition)** — SM-2 style scheduling. Tap card to flip (English ⇄ Urdu). Rate recall: Again / Hard / Good / Easy. Hard words resurface sooner; mastered ones space out.
6. **Daily Quiz** — 10 questions/day mixing:
   - Multiple choice (pick correct Urdu meaning)
   - Reverse multiple choice (pick English word for an Urdu meaning)
   - Fill-in-the-blank using example sentence
   - Score + streak tracking
7. **Word of the Day** — one word highlighted on home screen daily, with full details and example.
8. **Progress dashboard** — total words, mastered, due for review today, current streak, weekly activity chart.
9. **Installable PWA** — "Add to Home Screen" on phone with app icon and standalone display.

## Screens

- `/login` — Email/password + Google
- `/` (home) — Word of the day, "Review N due", "Start daily quiz", quick stats
- `/words` — list, search, filter, add button
- `/words/add` and `/words/:id` — form for the 6 fields above
- `/import` — upload document, preview parsed rows, confirm
- `/review` — flashcard session
- `/quiz` — daily quiz session
- `/profile` — stats, streak, sign out

## Tech / data

- **Lovable Cloud** for auth, database, storage (uploaded documents), and a server function for AI-assisted parsing/translation.
- **Tables**: `profiles`, `words` (with SRS fields: ease, interval, due_at, repetitions), `reviews` (history), `quiz_sessions`, `daily_streaks`.
- RLS so each user only sees their own words.
- Lovable AI Gateway for document parsing and auto-filling Urdu translations / example sentences when missing.

## Build order

1. Enable Lovable Cloud, set up auth (email + Google) and database schema.
2. Add/edit/list words with all 6 fields.
3. Flashcard review with spaced repetition.
4. Daily quiz + streak.
5. Word of the day + home dashboard.
6. Document import (upload → AI parse → review → save).
7. PWA manifest + icons for "Add to Home Screen".

## Design direction

Mobile-first, calm study aesthetic with bilingual typography (a clean Latin font paired with a Nastaliq/Urdu-friendly font like Noto Nastaliq Urdu) so Urdu text reads beautifully. I'll propose color/typography options before building.

## What I need from you when we start

- Your vocabulary document (PDF/Word/Excel/text) for the import step. We can build the rest first and import later if it's not ready.
